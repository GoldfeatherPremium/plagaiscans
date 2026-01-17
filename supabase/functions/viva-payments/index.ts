import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VivaOrderRequest {
  userId: string;
  credits: number;
  amountUsd: number;
  orderId: string;
  customerEmail: string;
  customerName: string;
  creditType?: string;
}

async function getVivaAccessToken(clientId: string, clientSecret: string, isDemo: boolean): Promise<string> {
  const baseUrl = isDemo 
    ? 'https://demo-accounts.vivapayments.com' 
    : 'https://accounts.vivapayments.com';
  
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch(`${baseUrl}/connect/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Viva OAuth error:', errorText);
    throw new Error(`Failed to get Viva access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function createVivaOrder(
  accessToken: string,
  amount: number,
  customerEmail: string,
  customerName: string,
  merchantTrns: string,
  sourceCode: string,
  isDemo: boolean
): Promise<{ orderCode: string }> {
  const baseUrl = isDemo 
    ? 'https://demo-api.vivapayments.com' 
    : 'https://api.vivapayments.com';

  // Amount should be in cents (smallest currency unit)
  const amountCents = Math.round(amount * 100);

  const orderData = {
    amount: amountCents,
    currencyCode: 840, // ISO 4217 code for USD
    customerTrns: merchantTrns,
    customer: {
      email: customerEmail,
      fullName: customerName || 'Customer',
    },
    sourceCode: sourceCode,
    disableExactAmount: false,
    disableCash: true,
    disableWallet: false,
  };

  console.log('Creating Viva order:', JSON.stringify(orderData));

  const response = await fetch(`${baseUrl}/checkout/v2/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Viva order creation error:', errorText);
    throw new Error(`Failed to create Viva order: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('Viva order created:', data);
  return { orderCode: data.orderCode };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'create';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Viva settings
    const { data: settings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['viva_source_code', 'viva_environment']);

    const sourceCode = settings?.find(s => s.key === 'viva_source_code')?.value || '';
    const environment = settings?.find(s => s.key === 'viva_environment')?.value || 'demo';
    const isDemo = environment === 'demo';

    const vivaClientId = Deno.env.get('VIVA_CLIENT_ID');
    const vivaClientSecret = Deno.env.get('VIVA_CLIENT_SECRET');

    if (!vivaClientId || !vivaClientSecret) {
      throw new Error('Viva.com credentials not configured');
    }

    if (!sourceCode) {
      throw new Error('Viva.com source code not configured');
    }

    if (action === 'create') {
      const body: VivaOrderRequest = await req.json();
      const { userId, credits, amountUsd, orderId, customerEmail, customerName, creditType = 'full' } = body;

      if (!userId || !credits || !amountUsd) {
        return new Response(
          JSON.stringify({ success: false, error: 'Missing required fields' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      console.log(`Creating Viva payment for user ${userId}: ${credits} credits, $${amountUsd}`);

      // Get access token
      const accessToken = await getVivaAccessToken(vivaClientId, vivaClientSecret, isDemo);

      // Create order
      const merchantTrns = `${credits} Credits - ${orderId}`;
      const { orderCode } = await createVivaOrder(
        accessToken,
        amountUsd,
        customerEmail,
        customerName,
        merchantTrns,
        sourceCode,
        isDemo
      );

      // Store payment record
      const { error: insertError } = await supabase
        .from('viva_payments')
        .insert({
          user_id: userId,
          order_code: orderCode,
          amount_usd: amountUsd,
          amount_cents: Math.round(amountUsd * 100),
          credits: credits,
          credit_type: creditType,
          status: 'pending',
          customer_email: customerEmail,
          merchant_trns: merchantTrns,
          source_code: sourceCode,
        });

      if (insertError) {
        console.error('Failed to store Viva payment:', insertError);
        throw new Error('Failed to store payment record');
      }

      // Build checkout URL
      const checkoutBaseUrl = isDemo 
        ? 'https://demo.vivapayments.com/web/checkout' 
        : 'https://www.vivapayments.com/web/checkout';
      
      const checkoutUrl = `${checkoutBaseUrl}?ref=${orderCode}`;

      console.log(`Viva order created: ${orderCode}, checkout: ${checkoutUrl}`);

      return new Response(
        JSON.stringify({
          success: true,
          orderCode,
          checkoutUrl,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error: any) {
    console.error('Viva payments error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
