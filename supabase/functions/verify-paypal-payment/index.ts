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

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Order ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get PayPal credentials
    const { data: settings } = await supabaseClient
      .from('settings')
      .select('key, value')
      .in('key', ['paypal_client_id', 'paypal_client_secret', 'paypal_environment']);

    const clientId = settings?.find(s => s.key === 'paypal_client_id')?.value;
    const clientSecret = settings?.find(s => s.key === 'paypal_client_secret')?.value;
    const environment = settings?.find(s => s.key === 'paypal_environment')?.value || 'live';

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'PayPal is not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get access token
    const baseUrl = environment === 'sandbox' 
      ? 'https://api-m.sandbox.paypal.com' 
      : 'https://api-m.paypal.com';

    const authString = btoa(`${clientId}:${clientSecret}`);
    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with PayPal' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get order details from PayPal
    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!orderResponse.ok) {
      console.error('PayPal order fetch error:', await orderResponse.text());
      return new Response(
        JSON.stringify({ error: 'Failed to get order details' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orderData = await orderResponse.json();
    console.log('PayPal order status:', orderData.status);

    // Check our database for the payment
    const { data: payment } = await supabaseClient
      .from('paypal_payments')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    // If order is approved but not captured, capture it
    if (orderData.status === 'APPROVED' && payment?.status !== 'completed') {
      const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!captureResponse.ok) {
        const errorText = await captureResponse.text();
        console.error('PayPal capture error:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to capture payment' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const captureData = await captureResponse.json();
      console.log('Payment captured:', captureData.status);

      if (captureData.status === 'COMPLETED') {
        // Payment captured successfully, add credits
        if (payment && payment.status !== 'completed') {
          const userId = payment.user_id;
          const credits = payment.credits;
          const creditType = payment.credit_type || 'full';

          // Get current balance
          const { data: profile } = await supabaseClient
            .from('profiles')
            .select('credit_balance, similarity_credit_balance')
            .eq('id', userId)
            .single();

          if (profile) {
            // Add credits
            if (creditType === 'similarity') {
              const newBalance = (profile.similarity_credit_balance || 0) + credits;
              await supabaseClient
                .from('profiles')
                .update({ similarity_credit_balance: newBalance })
                .eq('id', userId);

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
            const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
            await supabaseClient
              .from('paypal_payments')
              .update({
                status: 'completed',
                payment_id: captureId,
                completed_at: new Date().toISOString(),
                payer_id: captureData.payer?.payer_id,
                payer_email: captureData.payer?.email_address,
              })
              .eq('order_id', orderId);

            // Get updated balance
            const { data: updatedProfile } = await supabaseClient
              .from('profiles')
              .select('credit_balance, similarity_credit_balance')
              .eq('id', userId)
              .single();

            return new Response(
              JSON.stringify({
                success: true,
                creditsAdded: credits,
                newBalance: creditType === 'similarity' 
                  ? updatedProfile?.similarity_credit_balance 
                  : updatedProfile?.credit_balance,
                amountPaid: payment.amount_usd,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
    }

    // Payment already completed or in another state
    if (payment?.status === 'completed') {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('credit_balance, similarity_credit_balance')
        .eq('id', payment.user_id)
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          creditsAdded: payment.credits,
          newBalance: payment.credit_type === 'similarity' 
            ? profile?.similarity_credit_balance 
            : profile?.credit_balance,
          amountPaid: payment.amount_usd,
          alreadyProcessed: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        status: orderData.status,
        message: 'Payment not yet completed',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('PayPal verification error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
