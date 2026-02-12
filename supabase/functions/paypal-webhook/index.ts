import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload = await req.json();
    const eventType = payload.event_type;
    const eventId = payload.id;

    console.log('PayPal webhook received:', eventType, eventId);

    // Log the webhook
    await supabaseClient.from('paypal_webhook_logs').insert({
      event_id: eventId,
      event_type: eventType,
      payload: payload,
      processed: false,
    });

    // Check for duplicate processing
    const { data: existingLog } = await supabaseClient
      .from('paypal_webhook_logs')
      .select('id')
      .eq('event_id', eventId)
      .eq('processed', true)
      .maybeSingle();

    if (existingLog) {
      console.log('Event already processed:', eventId);
      return new Response(JSON.stringify({ received: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Handle different event types
    if (eventType === 'CHECKOUT.ORDER.APPROVED' || eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const resource = payload.resource;
      let orderId: string;
      let captureId: string | null = null;

      if (eventType === 'CHECKOUT.ORDER.APPROVED') {
        orderId = resource.id;
      } else {
        // PAYMENT.CAPTURE.COMPLETED
        captureId = resource.id;
        orderId = resource.supplementary_data?.related_ids?.order_id || 
                  resource.custom_id?.split('"')[0] || '';
        
        // Try to find order ID from existing payment records if not in webhook
        if (!orderId) {
          const { data: existingPayment } = await supabaseClient
            .from('paypal_payments')
            .select('order_id')
            .eq('payment_id', captureId)
            .maybeSingle();
          
          if (existingPayment) {
            orderId = existingPayment.order_id;
          }
        }
      }

      if (!orderId) {
        console.error('Could not determine order ID from webhook');
        await supabaseClient
          .from('paypal_webhook_logs')
          .update({ processed: true, error_message: 'Could not determine order ID' })
          .eq('event_id', eventId);
        return new Response(JSON.stringify({ received: true }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Get the payment record
      const { data: payment, error: paymentError } = await supabaseClient
        .from('paypal_payments')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();

      if (paymentError || !payment) {
        console.error('Payment not found for order:', orderId);
        await supabaseClient
          .from('paypal_webhook_logs')
          .update({ processed: true, error_message: 'Payment not found' })
          .eq('event_id', eventId);
        return new Response(JSON.stringify({ received: true }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Skip if already completed
      if (payment.status === 'completed') {
        console.log('Payment already completed:', orderId);
        await supabaseClient
          .from('paypal_webhook_logs')
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq('event_id', eventId);
        return new Response(JSON.stringify({ received: true }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // For PAYMENT.CAPTURE.COMPLETED, add credits
      if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
        const userId = payment.user_id;
        const credits = payment.credits;
        const creditType = payment.credit_type || 'full';

        // Get current balance
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('credit_balance, similarity_credit_balance')
          .eq('id', userId)
          .single();

        if (!profile) {
          console.error('User profile not found:', userId);
          await supabaseClient
            .from('paypal_webhook_logs')
            .update({ processed: true, error_message: 'User profile not found' })
            .eq('event_id', eventId);
          return new Response(JSON.stringify({ received: true }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        // Add credits based on type
        if (creditType === 'similarity') {
          const newBalance = (profile.similarity_credit_balance || 0) + credits;
          await supabaseClient
            .from('profiles')
            .update({ similarity_credit_balance: newBalance })
            .eq('id', userId);

          // Log transaction
          await supabaseClient.from('credit_transactions').insert({
            user_id: userId,
            amount: credits,
            transaction_type: 'purchase',
            credit_type: 'similarity',
            balance_before: profile.similarity_credit_balance || 0,
            balance_after: newBalance,
            description: `PayPal purchase - ${credits} similarity credits`,
          });
        } else {
          const newBalance = (profile.credit_balance || 0) + credits;
          await supabaseClient
            .from('profiles')
            .update({ credit_balance: newBalance })
            .eq('id', userId);

          // Log transaction
          await supabaseClient.from('credit_transactions').insert({
            user_id: userId,
            amount: credits,
            transaction_type: 'purchase',
            credit_type: 'full',
            balance_before: profile.credit_balance || 0,
            balance_after: newBalance,
            description: `PayPal purchase - ${credits} credits`,
          });
        }

        // Update payment status
        await supabaseClient
          .from('paypal_payments')
          .update({
            status: 'completed',
            payment_id: captureId,
            completed_at: new Date().toISOString(),
            payer_id: resource.payer?.payer_id,
            payer_email: resource.payer?.email_address,
          })
          .eq('order_id', orderId);

        // Create receipt
        try {
          await supabaseClient.functions.invoke('create-receipt', {
            body: {
              userId,
              credits,
              amountPaid: payment.amount_usd,
              paymentMethod: 'PayPal',
              paymentId: orderId,
            },
          });
        } catch (e) {
          console.error('Error creating receipt:', e);
        }

        // Send notification
        try {
          await supabaseClient.functions.invoke('send-payment-confirmation-email', {
            body: {
              userId,
              credits,
              amount: payment.amount_usd,
              paymentMethod: 'PayPal',
            },
          });
        } catch (e) {
          console.error('Error sending notification:', e);
        }

        // --- Credit Validity Record ---
        try {
          let validityDays = 365;
          const { data: pkg } = await supabaseClient
            .from('pricing_packages')
            .select('id, validity_days')
            .eq('credits', credits)
            .eq('credit_type', creditType)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

          if (pkg?.validity_days) validityDays = pkg.validity_days;

          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + validityDays);

          await supabaseClient.from('credit_validity').insert({
            user_id: userId,
            credits_amount: credits,
            remaining_credits: credits,
            expires_at: expiresAt.toISOString(),
            credit_type: creditType,
            package_id: pkg?.id || null,
          });
          console.log('Credit validity record created', { validityDays });
        } catch (cvError) {
          console.error('Failed to create credit validity record:', cvError);
        }

        console.log('PayPal payment completed:', orderId, 'Credits added:', credits);
      } else if (eventType === 'CHECKOUT.ORDER.APPROVED') {
        // Order approved, update status but don't add credits yet
        await supabaseClient
          .from('paypal_payments')
          .update({
            status: 'approved',
            payer_id: resource.payer?.payer_id,
            payer_email: resource.payer?.email_address,
          })
          .eq('order_id', orderId);

        console.log('PayPal order approved:', orderId);
      }

      // Mark webhook as processed
      await supabaseClient
        .from('paypal_webhook_logs')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('event_id', eventId);
    }

    return new Response(JSON.stringify({ received: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: unknown) {
    console.error('PayPal webhook error:', error);
    const message = error instanceof Error ? error.message : 'Webhook processing error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
