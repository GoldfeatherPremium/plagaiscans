import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Viva API endpoints
const VIVA_ACCOUNTS_URL = 'https://accounts.vivapayments.com';
const VIVA_API_URL = 'https://api.vivapayments.com';

// For demo/sandbox, use:
// const VIVA_ACCOUNTS_URL = 'https://demo-accounts.vivapayments.com';
// const VIVA_API_URL = 'https://demo-api.vivapayments.com';

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('VIVA_CLIENT_ID');
  const clientSecret = Deno.env.get('VIVA_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Viva credentials not configured');
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(`${VIVA_ACCOUNTS_URL}/connect/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token error:', errorText);
    throw new Error('Failed to get Viva access token');
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  console.log(`Viva payments action: ${action}`);

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (action === 'create' && req.method === 'POST') {
      // Create a payment order
      const { userId, credits, amountUsd, orderId, customerEmail, customerName, successUrl, failureUrl } = await req.json();

      console.log(`Creating Viva payment for user ${userId}: ${credits} credits, $${amountUsd}`);

      // Get source code from settings
      const { data: sourceCodeSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'viva_source_code')
        .single();
      
      const sourceCode = sourceCodeSetting?.value || '2984';
      console.log(`Using Viva source code: ${sourceCode}`);

      // Get access token
      const accessToken = await getAccessToken();

      // Amount in cents (Viva uses smallest currency unit * 100)
      const amountCents = Math.round(amountUsd * 100);

      // Create payment order
      const orderPayload = {
        amount: amountCents,
        customerTrns: `Purchase ${credits} credits`,
        customer: {
          email: customerEmail || '',
          fullName: customerName || '',
        },
        paymentTimeout: 1800, // 30 minutes
        preauth: false,
        allowRecurring: false,
        maxInstallments: 0,
        paymentNotification: true,
        sourceCode: sourceCode,
        merchantTrns: orderId,
        tags: ['credits', `user_${userId}`],
      };

      const orderResponse = await fetch(`${VIVA_API_URL}/checkout/v2/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
      });

      if (!orderResponse.ok) {
        const errorText = await orderResponse.text();
        console.error('Order creation error:', {
          status: orderResponse.status,
          statusText: orderResponse.statusText,
          body: errorText,
        });
        throw new Error('Failed to create Viva payment order');
      }

      const orderData = await orderResponse.json();
      console.log('Viva order created:', orderData);

      // Store payment record in database
      const { error: dbError } = await supabase.from('viva_payments').insert({
        user_id: userId,
        order_code: orderData.orderCode.toString(),
        amount_usd: amountUsd,
        credits: credits,
        status: 'pending',
        merchant_trns: orderId,
      });

      if (dbError) {
        console.error('DB insert error:', dbError);
      }

      // Generate checkout URL
      const checkoutUrl = `https://www.vivapayments.com/web/checkout?ref=${orderData.orderCode}`;
      // For demo: const checkoutUrl = `https://demo.vivapayments.com/web/checkout?ref=${orderData.orderCode}`;

      return new Response(
        JSON.stringify({
          success: true,
          orderCode: orderData.orderCode,
          checkoutUrl,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'webhook' && req.method === 'POST') {
      // Handle Viva webhook callback
      const payload = await req.json();
      console.log('Viva webhook payload:', JSON.stringify(payload));

      const { EventTypeId, EventData } = payload;

      // EventTypeId 1796 = Transaction Payment Created (successful payment)
      if (EventTypeId === 1796 && EventData) {
        const { OrderCode, TransactionId, StatusId, Amount } = EventData;

        console.log(`Payment completed: OrderCode=${OrderCode}, TransactionId=${TransactionId}, Status=${StatusId}`);

        // StatusId 'F' means the transaction was successful
        if (StatusId === 'F') {
          // Find the payment record
          const { data: payment, error: findError } = await supabase
            .from('viva_payments')
            .select('*')
            .eq('order_code', OrderCode.toString())
            .single();

          if (findError || !payment) {
            console.error('Payment not found:', findError);
            return new Response(JSON.stringify({ error: 'Payment not found' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          // Update payment status
          await supabase
            .from('viva_payments')
            .update({
              status: 'completed',
              transaction_id: TransactionId,
              completed_at: new Date().toISOString(),
            })
            .eq('order_code', OrderCode.toString());

          // Add credits to user's balance
          const { data: profile } = await supabase
            .from('profiles')
            .select('credit_balance')
            .eq('id', payment.user_id)
            .single();

          const currentBalance = profile?.credit_balance || 0;
          const newBalance = currentBalance + payment.credits;

          await supabase
            .from('profiles')
            .update({ credit_balance: newBalance })
            .eq('id', payment.user_id);

          // Log the transaction
          await supabase.from('credit_transactions').insert({
            user_id: payment.user_id,
            amount: payment.credits,
            balance_before: currentBalance,
            balance_after: newBalance,
            transaction_type: 'purchase',
            description: `Viva.com payment - ${payment.credits} credits`,
          });

          // Send in-app notification
          await supabase.from('user_notifications').insert({
            user_id: payment.user_id,
            title: '✅ Payment Successful',
            message: `Your payment of $${payment.amount_usd} was successful! ${payment.credits} credits have been added to your account.`,
          });

          // Send payment verified email
          try {
            const emailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-payment-verified-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                userId: payment.user_id,
                credits: payment.credits,
                amount: payment.amount_usd,
                paymentMethod: 'Viva.com Card Payment',
              }),
            });
            console.log('Payment email sent:', await emailResponse.text());
          } catch (emailError) {
            console.error('Failed to send payment email:', emailError);
          }

          // Send push notification
          try {
            const pushResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                userId: payment.user_id,
                title: 'Payment Successful! 💳',
                body: `${payment.credits} credits have been added to your account.`,
                data: { type: 'payment_success', url: '/dashboard' },
              }),
            });
            console.log('Push notification sent:', await pushResponse.text());
          } catch (pushError) {
            console.error('Failed to send push notification:', pushError);
          }

          console.log(`Credits added: ${payment.credits} to user ${payment.user_id}`);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'verify' && req.method === 'GET') {
      // Verify payment status by order code
      const orderCode = url.searchParams.get('order_code');

      if (!orderCode) {
        return new Response(JSON.stringify({ error: 'Order code required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: payment, error } = await supabase
        .from('viva_payments')
        .select('*')
        .eq('order_code', orderCode)
        .single();

      if (error || !payment) {
        return new Response(JSON.stringify({ error: 'Payment not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: payment.status,
          credits: payment.credits,
          amount: payment.amount_usd,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Viva payments error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
