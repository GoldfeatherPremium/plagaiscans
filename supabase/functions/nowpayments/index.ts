import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOWPAYMENTS_API_KEY = Deno.env.get('NOWPAYMENTS_API_KEY')!;
const NOWPAYMENTS_IPN_SECRET = Deno.env.get('NOWPAYMENTS_IPN_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper to create HMAC signature for IPN verification
async function verifyIpnSignature(body: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(NOWPAYMENTS_IPN_SECRET),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    
    // Sort the body keys alphabetically for signature verification
    const sortedBody = JSON.stringify(
      Object.keys(JSON.parse(body))
        .sort()
        .reduce((obj: Record<string, unknown>, key: string) => {
          obj[key] = JSON.parse(body)[key];
          return obj;
        }, {})
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(sortedBody));
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return computedSignature === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Create payment
    if (action === 'create' && req.method === 'POST') {
      const { userId, credits, amountUsd, orderId } = await req.json();
      
      console.log('Creating payment:', { userId, credits, amountUsd, orderId });

      // Get callback URL
      const callbackUrl = `${SUPABASE_URL}/functions/v1/nowpayments?action=ipn`;

      // Create payment via NOWPayments API
      const response = await fetch('https://api.nowpayments.io/v1/payment', {
        method: 'POST',
        headers: {
          'x-api-key': NOWPAYMENTS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price_amount: amountUsd,
          price_currency: 'usd',
          pay_currency: 'usdttrc20',
          order_id: orderId,
          order_description: `${credits} Credits Purchase`,
          ipn_callback_url: callbackUrl,
        }),
      });

      const paymentData = await response.json();
      console.log('NOWPayments response:', paymentData);

      if (!response.ok || paymentData.code) {
        throw new Error(paymentData.message || 'Failed to create payment');
      }

      // Store payment in database
      const { error: dbError } = await supabase
        .from('crypto_payments')
        .insert({
          user_id: userId,
          payment_id: paymentData.payment_id.toString(),
          order_id: orderId,
          credits,
          amount_usd: amountUsd,
          pay_amount: paymentData.pay_amount,
          pay_currency: paymentData.pay_currency,
          pay_address: paymentData.pay_address,
          status: paymentData.payment_status || 'waiting',
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error('Failed to store payment');
      }

      return new Response(JSON.stringify({
        success: true,
        payment: {
          paymentId: paymentData.payment_id,
          payAddress: paymentData.pay_address,
          payAmount: paymentData.pay_amount,
          payCurrency: paymentData.pay_currency,
          status: paymentData.payment_status,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // IPN Callback handler
    if (action === 'ipn' && req.method === 'POST') {
      const body = await req.text();
      const signature = req.headers.get('x-nowpayments-sig') || '';
      
      console.log('IPN received:', body);

      // Verify signature
      const isValid = await verifyIpnSignature(body, signature);
      if (!isValid) {
        console.error('Invalid IPN signature');
        return new Response('Invalid signature', { status: 400 });
      }

      const data = JSON.parse(body);
      const { payment_id, payment_status, order_id } = data;

      console.log('IPN data:', { payment_id, payment_status, order_id });

      // Update payment status
      const { data: payment, error: updateError } = await supabase
        .from('crypto_payments')
        .update({ status: payment_status })
        .eq('payment_id', payment_id.toString())
        .select()
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        return new Response('Database error', { status: 500 });
      }

      // If payment is finished, add credits to user
      if (payment_status === 'finished' && payment) {
        console.log('Payment finished, adding credits:', payment.credits);

        // Get current balance
        const { data: profile } = await supabase
          .from('profiles')
          .select('credit_balance')
          .eq('id', payment.user_id)
          .single();

        const currentBalance = profile?.credit_balance || 0;
        const newBalance = currentBalance + payment.credits;

        // Update balance
        await supabase
          .from('profiles')
          .update({ credit_balance: newBalance })
          .eq('id', payment.user_id);

        // Log transaction
        await supabase
          .from('credit_transactions')
          .insert({
            user_id: payment.user_id,
            amount: payment.credits,
            balance_before: currentBalance,
            balance_after: newBalance,
            transaction_type: 'purchase',
            description: `USDT Payment - ${payment.amount_usd} USD`,
          });

        // Send notification
        await supabase
          .from('user_notifications')
          .insert({
            user_id: payment.user_id,
            title: 'Payment Received! 🎉',
            message: `Your payment of $${payment.amount_usd} has been confirmed. ${payment.credits} credits have been added to your account.`,
          });

        console.log('Credits added successfully');
      }

      return new Response('OK', { status: 200 });
    }

    // Check payment status
    if (action === 'status' && req.method === 'GET') {
      const paymentId = url.searchParams.get('payment_id');
      
      if (!paymentId) {
        return new Response(JSON.stringify({ error: 'Missing payment_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get from NOWPayments API
      const response = await fetch(`https://api.nowpayments.io/v1/payment/${paymentId}`, {
        headers: { 'x-api-key': NOWPAYMENTS_API_KEY },
      });

      const statusData = await response.json();

      // Update local status
      if (statusData.payment_status) {
        await supabase
          .from('crypto_payments')
          .update({ status: statusData.payment_status })
          .eq('payment_id', paymentId);
      }

      return new Response(JSON.stringify({
        status: statusData.payment_status,
        payAmount: statusData.pay_amount,
        actuallyPaid: statusData.actually_paid,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
