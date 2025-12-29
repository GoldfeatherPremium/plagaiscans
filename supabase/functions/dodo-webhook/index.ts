import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, dodo-signature',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const webhookKey = Deno.env.get('DODO_PAYMENTS_WEBHOOK_KEY');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get webhook signature for verification
    const signature = req.headers.get('dodo-signature') || req.headers.get('x-dodo-signature');
    
    const body = await req.text();
    const event = JSON.parse(body);

    console.log('Dodo webhook received:', {
      type: event.type || event.event_type,
      paymentId: event.data?.payment_id || event.payment_id,
      signature: signature ? 'present' : 'missing',
    });

    // TODO: Verify webhook signature when Dodo provides documentation
    // For now, we'll process the webhook but log a warning if no signature
    if (!signature && webhookKey) {
      console.warn('Webhook signature missing - consider implementing verification');
    }

    const eventType = event.type || event.event_type;
    const paymentData = event.data || event;
    const paymentId = paymentData.payment_id || paymentData.id;
    const metadata = paymentData.metadata || {};

    console.log('Processing event:', { eventType, paymentId, metadata });

    if (eventType === 'payment.succeeded' || eventType === 'payment_success' || eventType === 'payment.completed') {
      // Get user_id from metadata or find payment in database
      let userId = metadata.user_id;
      let credits = parseInt(metadata.credits || '0');

      if (!userId) {
        // Try to find payment in database - check both payment_id and checkout_session_id
        const { data: existingPayment } = await supabase
          .from('dodo_payments')
          .select('*')
          .or(`payment_id.eq.${paymentId},checkout_session_id.eq.${paymentId}`)
          .single();

        if (existingPayment) {
          userId = existingPayment.user_id;
          credits = existingPayment.credits;
        }
      }

      if (!userId) {
        console.error('Could not determine user_id for payment:', paymentId);
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Idempotency check - check if already processed
      const { data: existingKey } = await supabase
        .from('payment_idempotency_keys')
        .select('key')
        .eq('key', paymentId)
        .eq('provider', 'dodo')
        .single();

      if (existingKey) {
        console.log('Payment already processed (idempotency check):', paymentId);
        return new Response(
          JSON.stringify({ success: true, message: 'Already processed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert idempotency key
      await supabase.from('payment_idempotency_keys').insert({
        key: paymentId,
        provider: 'dodo',
        user_id: userId,
      });

      // Get user's current balance
      const { data: profile } = await supabase
        .from('profiles')
        .select('credit_balance, email, full_name')
        .eq('id', userId)
        .single();

      if (!profile) {
        console.error('Profile not found for user:', userId);
        return new Response(
          JSON.stringify({ error: 'Profile not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const balanceBefore = profile.credit_balance;
      const balanceAfter = balanceBefore + credits;

      console.log('Adding credits:', { userId, credits, balanceBefore, balanceAfter });

      // Update user balance
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ credit_balance: balanceAfter })
        .eq('id', userId);

      if (balanceError) {
        console.error('Failed to update balance:', balanceError);
        throw balanceError;
      }

      // Log credit transaction
      await supabase.from('credit_transactions').insert({
        user_id: userId,
        amount: credits,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        transaction_type: 'purchase',
        description: `Dodo Payments - ${credits} credits`,
      });

      // Update dodo_payments table - check both payment_id and checkout_session_id
      const { error: paymentUpdateError } = await supabase
        .from('dodo_payments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          receipt_url: paymentData.receipt_url,
        })
        .or(`payment_id.eq.${paymentId},checkout_session_id.eq.${paymentId}`);

      if (paymentUpdateError) {
        console.error('Failed to update payment record:', paymentUpdateError);
      }

      // Get payment record for invoice - check both fields
      const { data: dodoPayment } = await supabase
        .from('dodo_payments')
        .select('*')
        .or(`payment_id.eq.${paymentId},checkout_session_id.eq.${paymentId}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const amountUsd = dodoPayment?.amount_usd || (paymentData.amount ? paymentData.amount / 100 : 0);

      // Create invoice
      try {
        await supabase.functions.invoke('create-invoice', {
          body: {
            userId,
            amountUsd,
            credits,
            paymentType: 'dodo',
            paymentId,
            customerEmail: profile.email,
            customerName: profile.full_name,
          },
        });
        console.log('Invoice created');
      } catch (invoiceError) {
        console.error('Failed to create invoice:', invoiceError);
      }

      // Create receipt
      try {
        await supabase.functions.invoke('create-receipt', {
          body: {
            userId,
            amountPaid: amountUsd,
            credits,
            paymentMethod: 'dodo',
            paymentId,
            customerEmail: profile.email,
            customerName: profile.full_name,
          },
        });
        console.log('Receipt created');
      } catch (receiptError) {
        console.error('Failed to create receipt:', receiptError);
      }

      // Send user notification
      await supabase.from('user_notifications').insert({
        user_id: userId,
        title: '✅ Payment Successful',
        message: `Your payment was successful! ${credits} credits have been added to your account.`,
      });

      // Send push notification
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            userId,
            title: '✅ Payment Confirmed',
            body: `${credits} credits added to your account!`,
            data: { url: '/dashboard' },
          },
        });
      } catch (pushError) {
        console.error('Failed to send push notification:', pushError);
      }

      console.log('Payment processed successfully:', { paymentId, userId, credits });

      return new Response(
        JSON.stringify({ success: true, message: 'Payment processed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (eventType === 'payment.failed' || eventType === 'payment_failed') {
      // Update payment status
      await supabase
        .from('dodo_payments')
        .update({ status: 'failed' })
        .eq('payment_id', paymentId);

      console.log('Payment marked as failed:', paymentId);

      return new Response(
        JSON.stringify({ success: true, message: 'Payment failure recorded' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (eventType === 'payment.refunded' || eventType === 'refund.created') {
      // Update payment status
      await supabase
        .from('dodo_payments')
        .update({ status: 'refunded' })
        .eq('payment_id', paymentId);

      console.log('Payment marked as refunded:', paymentId);

      return new Response(
        JSON.stringify({ success: true, message: 'Refund recorded' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Unknown event type - acknowledge anyway
    console.log('Unhandled event type:', eventType);
    return new Response(
      JSON.stringify({ success: true, message: 'Event acknowledged' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Webhook processing error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
