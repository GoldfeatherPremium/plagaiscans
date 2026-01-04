import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const dodoApiKey = Deno.env.get('DODO_PAYMENTS_API_KEY');
    const dodoDefaultProductId = Deno.env.get('DODO_CREDITS_PRODUCT_ID');

    if (!dodoApiKey) {
      console.error('DODO_PAYMENTS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Dodo Payments not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { credits, amount, creditType = 'full', cartItems } = await req.json();

    if (!credits || !amount) {
      return new Response(
        JSON.stringify({ error: 'Credits and amount are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single();

    const amountUsd = amount / 100; // Convert from cents
    const orderId = `dodo_${Date.now()}_${user.id.slice(0, 8)}`;

    console.log('Creating Dodo payment:', { userId: user.id, credits, amountUsd, orderId, creditType, cartItems });

    // Get origin for return URL
    const origin = req.headers.get('origin') || 'https://plagaiscans.com';

    // Create Dodo checkout session
    const dodoBaseUrl = 'https://live.dodopayments.com';
    
    // Build product_cart from cart items
    const productCart: { product_id: string; quantity: number }[] = [];
    
    if (cartItems && Array.isArray(cartItems) && cartItems.length > 0) {
      // For each cart item, look up the dodo_product_id from the pricing_packages table
      for (const item of cartItems) {
        const { data: packageData, error: packageError } = await supabase
          .from('pricing_packages')
          .select('dodo_product_id')
          .eq('id', item.packageId)
          .eq('is_active', true)
          .single();

        if (packageError || !packageData?.dodo_product_id) {
          // Try to find by credits and credit_type as fallback
          const { data: fallbackData } = await supabase
            .from('pricing_packages')
            .select('dodo_product_id')
            .eq('credits', item.credits)
            .eq('credit_type', item.creditType || 'full')
            .eq('is_active', true)
            .not('dodo_product_id', 'is', null)
            .limit(1)
            .single();

          if (fallbackData?.dodo_product_id) {
            productCart.push({
              product_id: fallbackData.dodo_product_id,
              quantity: item.quantity || 1,
            });
            console.log(`Found dodo_product_id for ${item.credits} credits via fallback:`, fallbackData.dodo_product_id);
          } else if (dodoDefaultProductId) {
            // Use default product ID as last resort
            productCart.push({
              product_id: dodoDefaultProductId,
              quantity: item.quantity || 1,
            });
            console.log(`Using default product ID for ${item.credits} credits:`, dodoDefaultProductId);
          } else {
            console.error(`No Dodo product ID found for package ${item.packageId} with ${item.credits} credits`);
            return new Response(
              JSON.stringify({ error: `Dodo product not configured for ${item.credits} credits package` }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          productCart.push({
            product_id: packageData.dodo_product_id,
            quantity: item.quantity || 1,
          });
          console.log(`Found dodo_product_id for package ${item.packageId}:`, packageData.dodo_product_id);
        }
      }
    } else {
      // Legacy support: single item checkout
      let dodoProductId = dodoDefaultProductId;
      
      const { data: packageData } = await supabase
        .from('pricing_packages')
        .select('dodo_product_id')
        .eq('credits', credits)
        .eq('credit_type', creditType)
        .eq('is_active', true)
        .not('dodo_product_id', 'is', null)
        .limit(1)
        .single();

      if (packageData?.dodo_product_id) {
        dodoProductId = packageData.dodo_product_id;
      }

      if (!dodoProductId) {
        console.error('No Dodo product ID available');
        return new Response(
          JSON.stringify({ error: 'Dodo product not configured for this package' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      productCart.push({
        product_id: dodoProductId,
        quantity: 1,
      });
    }

    console.log('Product cart for Dodo:', productCart);

    const dodoResponse = await fetch(`${dodoBaseUrl}/checkouts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dodoApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        customer: {
          email: profile?.email || user.email,
          name: profile?.full_name || 'Customer',
        },
        product_cart: productCart,
        return_url: `${origin}/dashboard/payment-success?provider=dodo&payment_id=${orderId}`,
        metadata: {
          user_id: user.id,
          credits: credits.toString(),
          credit_type: creditType,
          order_id: orderId,
        },
      }),
    });

    // Dodo may sometimes return a non-JSON (or empty) body on errors.
    const rawBody = await dodoResponse.text();
    let dodoData: any = null;

    try {
      dodoData = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      console.error('Dodo API returned non-JSON body:', rawBody);
    }

    console.log('Dodo API response (parsed):', dodoData);

    if (!dodoResponse.ok) {
      console.error('Dodo API error:', { status: dodoResponse.status, rawBody, parsed: dodoData });
      return new Response(
        JSON.stringify({
          error:
            (dodoData && (dodoData.message || dodoData.error || dodoData.detail)) ||
            `Failed to create Dodo checkout session (HTTP ${dodoResponse.status})`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!dodoData) {
      console.error('Dodo API success response but empty body');
      return new Response(
        JSON.stringify({ error: 'Dodo returned an empty response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store payment in database - checkout session returns session_id and url
    const { error: dbError } = await supabase.from('dodo_payments').insert({
      user_id: user.id,
      payment_id: dodoData.session_id || orderId,
      checkout_session_id: dodoData.session_id,
      amount_usd: amountUsd,
      credits: credits,
      status: 'pending',
      customer_email: profile?.email || user.email,
      metadata: {
        order_id: orderId,
        dodo_response: dodoData,
      },
    });

    if (dbError) {
      console.error('Database insert error:', dbError);
      // Continue anyway - payment was created in Dodo
    }

    const checkoutUrl = dodoData.checkout_url || dodoData.url;

    console.log('Checkout session created:', { sessionId: dodoData.session_id, url: checkoutUrl });

    return new Response(
      JSON.stringify({
        success: true,
        url: checkoutUrl,
        paymentId: dodoData.session_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error creating Dodo checkout:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
