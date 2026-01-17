import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Viva.com webhook event types
const EVENT_TYPES: Record<number, string> = {
  1796: 'Transaction Payment Created',
  1798: 'Transaction Failed',
  4865: 'Order Updated',
};

interface VivaWebhookPayload {
  EventTypeId: number;
  EventData: {
    TransactionId?: string;
    OrderCode?: number | string;
    StatusId?: string;
    Amount?: number;
    CurrencyCode?: string;
    Email?: string;
    FullName?: string;
  };
  Created?: string;
  CorrelationId?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Viva.com verification request (GET)
  // When you register a webhook, Viva sends a GET request with a verification key
  if (req.method === 'GET') {
    console.log('Viva webhook verification request received');
    
    // Fetch the verification key from settings
    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'viva_webhook_verification_key')
      .single();

    const verificationKey = settings?.value || '';
    
    console.log('Returning verification key');
    return new Response(verificationKey, {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
    });
  }

  // Handle POST webhook events
  if (req.method === 'POST') {
    try {
      const payload: VivaWebhookPayload = await req.json();
      console.log('Viva webhook received:', JSON.stringify(payload));

      const eventTypeId = payload.EventTypeId;
      const eventType = EVENT_TYPES[eventTypeId] || `Unknown (${eventTypeId})`;
      const eventData = payload.EventData || {};
      const orderCode = String(eventData.OrderCode || '');
      const transactionId = eventData.TransactionId || '';

      // Generate unique event ID
      const eventId = `${eventTypeId}-${orderCode}-${transactionId}-${Date.now()}`;

      // Log the webhook event
      const { error: logError } = await supabase
        .from('viva_webhook_logs')
        .insert({
          event_id: eventId,
          event_type_id: eventTypeId,
          event_type: eventType,
          order_code: orderCode,
          transaction_id: transactionId,
          payload: payload,
          processed: false,
        });

      if (logError) {
        console.error('Failed to log webhook:', logError);
      }

      // Process successful payment (EventTypeId 1796)
      if (eventTypeId === 1796) {
        console.log(`Processing successful payment for order ${orderCode}`);

        // Find the payment record
        const { data: payment, error: paymentError } = await supabase
          .from('viva_payments')
          .select('*')
          .eq('order_code', orderCode)
          .single();

        if (paymentError || !payment) {
          console.error('Payment not found for order:', orderCode);
          
          // Update webhook log with error
          await supabase
            .from('viva_webhook_logs')
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
              error_message: 'Payment record not found',
            })
            .eq('event_id', eventId);

          return new Response(
            JSON.stringify({ success: false, error: 'Payment not found' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }

        // Check if already processed (idempotency)
        if (payment.status === 'completed') {
          console.log('Payment already processed:', orderCode);
          
          await supabase
            .from('viva_webhook_logs')
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
              error_message: 'Already processed',
            })
            .eq('event_id', eventId);

          return new Response(
            JSON.stringify({ success: true, message: 'Already processed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check idempotency key
        const idempotencyKey = `viva_${orderCode}`;
        const { data: existingKey } = await supabase
          .from('payment_idempotency_keys')
          .select('key')
          .eq('key', idempotencyKey)
          .single();

        if (existingKey) {
          console.log('Idempotency key exists:', idempotencyKey);
          return new Response(
            JSON.stringify({ success: true, message: 'Already processed' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Insert idempotency key
        await supabase
          .from('payment_idempotency_keys')
          .insert({ key: idempotencyKey, provider: 'viva', user_id: payment.user_id });

        // Update payment status
        const { error: updateError } = await supabase
          .from('viva_payments')
          .update({
            status: 'completed',
            transaction_id: transactionId,
            completed_at: new Date().toISOString(),
          })
          .eq('order_code', orderCode);

        if (updateError) {
          console.error('Failed to update payment status:', updateError);
          throw new Error('Failed to update payment');
        }

        // Get user's current credit balance
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('credit_balance, similarity_credit_balance, email, full_name')
          .eq('id', payment.user_id)
          .single();

        if (profileError || !profile) {
          console.error('User profile not found:', payment.user_id);
          throw new Error('User not found');
        }

        // Add credits based on credit type
        const creditType = payment.credit_type || 'full';
        const currentBalance = creditType === 'similarity' 
          ? profile.similarity_credit_balance 
          : profile.credit_balance;
        const newBalance = currentBalance + payment.credits;

        const updateField = creditType === 'similarity' 
          ? { similarity_credit_balance: newBalance }
          : { credit_balance: newBalance };

        const { error: creditError } = await supabase
          .from('profiles')
          .update(updateField)
          .eq('id', payment.user_id);

        if (creditError) {
          console.error('Failed to add credits:', creditError);
          throw new Error('Failed to add credits');
        }

        console.log(`Added ${payment.credits} ${creditType} credits to user ${payment.user_id}. New balance: ${newBalance}`);

        // Record credit transaction
        await supabase
          .from('credit_transactions')
          .insert({
            user_id: payment.user_id,
            amount: payment.credits,
            transaction_type: 'purchase',
            credit_type: creditType,
            balance_before: currentBalance,
            balance_after: newBalance,
            description: `Viva.com payment - Order ${orderCode}`,
          });

        // Create receipt
        try {
          await supabase.functions.invoke('create-receipt', {
            body: {
              userId: payment.user_id,
              amount: payment.amount_usd,
              credits: payment.credits,
              paymentMethod: 'Viva.com',
              transactionId: transactionId,
            },
          });
        } catch (receiptError) {
          console.error('Failed to create receipt:', receiptError);
        }

        // Send push notification
        try {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              userId: payment.user_id,
              title: 'Payment Successful! 🎉',
              body: `${payment.credits} credits have been added to your account.`,
              data: { url: '/dashboard' },
            },
          });
        } catch (pushError) {
          console.error('Failed to send push notification:', pushError);
        }

        // Update webhook log as processed
        await supabase
          .from('viva_webhook_logs')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq('event_id', eventId);

        console.log('Viva payment processed successfully:', orderCode);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Process failed payment (EventTypeId 1798)
      if (eventTypeId === 1798) {
        console.log(`Processing failed payment for order ${orderCode}`);

        await supabase
          .from('viva_payments')
          .update({
            status: 'failed',
            transaction_id: transactionId,
          })
          .eq('order_code', orderCode);

        await supabase
          .from('viva_webhook_logs')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
          })
          .eq('event_id', eventId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // For other events, just acknowledge
      await supabase
        .from('viva_webhook_logs')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq('event_id', eventId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error: any) {
      console.error('Viva webhook error:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
  );
});
