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

    // Get PayPal credentials from settings
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

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getUser(token);
    
    if (claimsError || !claimsData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.user.id;
    const { credits, amount, creditType } = await req.json();

    if (!credits || !amount) {
      return new Response(
        JSON.stringify({ error: 'Credits and amount are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get PayPal access token
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
      console.error('PayPal token error:', await tokenResponse.text());
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with PayPal' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get profile for email
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single();

    // Create PayPal order
    const amountValue = (amount / 100).toFixed(2); // Convert cents to dollars
    const orderId = `PP_${Date.now()}_${userId.slice(0, 8)}`;

    // Get the return URL from environment or use default
    const siteUrl = Deno.env.get('SITE_URL') || 'https://plagaiscans.lovable.app';

    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderId,
        description: `${credits} Credits Purchase`,
        custom_id: JSON.stringify({ userId, credits, creditType }),
        amount: {
          currency_code: 'USD',
          value: amountValue,
        },
      }],
      application_context: {
        brand_name: 'Plagai Scans',
        landing_page: 'LOGIN',
        user_action: 'PAY_NOW',
        return_url: `${siteUrl}/dashboard/payment-success?provider=paypal`,
        cancel_url: `${siteUrl}/dashboard/checkout`,
      },
    };

    const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error('PayPal order creation error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to create PayPal order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orderData = await orderResponse.json();
    const approvalUrl = orderData.links?.find((link: any) => link.rel === 'approve')?.href;

    if (!approvalUrl) {
      return new Response(
        JSON.stringify({ error: 'Failed to get PayPal approval URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store payment in database
    const { error: insertError } = await supabaseClient
      .from('paypal_payments')
      .insert({
        user_id: userId,
        order_id: orderData.id,
        amount_usd: parseFloat(amountValue),
        credits: credits,
        credit_type: creditType || 'full',
        status: 'pending',
        customer_email: profile?.email,
        metadata: { originalAmount: amount, environment },
      });

    if (insertError) {
      console.error('Error storing PayPal payment:', insertError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        orderId: orderData.id,
        approvalUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('PayPal checkout error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
