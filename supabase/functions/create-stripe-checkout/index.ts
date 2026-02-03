import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-STRIPE-CHECKOUT] ${step}${detailsStr}`);
};

// Rate limiting configuration
const RATE_LIMIT = 5; // Max requests
const RATE_WINDOW_MINUTES = 60; // Per hour

async function checkRateLimit(supabase: any, userId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_WINDOW_MINUTES * 60 * 1000);
  
  const { count } = await supabase
    .from('stripe_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', 'checkout')
    .gte('created_at', windowStart.toISOString());
    
  return (count || 0) < RATE_LIMIT;
}

async function recordRateLimit(supabase: any, userId: string) {
  await supabase
    .from('stripe_rate_limits')
    .insert({ user_id: userId, action: 'checkout' });
}

// Input validation
function validateInput(data: any): { valid: boolean; error?: string } {
  const { priceId, credits, amount, mode, creditType } = data;
  
  // Must have either priceId or amount
  if (!priceId && !amount) {
    return { valid: false, error: "Price ID or amount is required" };
  }
  
  // Credits must be positive
  if (!credits || credits <= 0) {
    return { valid: false, error: "Credits amount must be positive" };
  }
  
  // Amount validation if provided
  if (amount !== undefined) {
    if (typeof amount !== 'number' || amount <= 0 || amount > 99999999) {
      return { valid: false, error: "Invalid amount" };
    }
  }
  
  // Mode validation
  if (mode && !['payment', 'subscription'].includes(mode)) {
    return { valid: false, error: "Invalid payment mode" };
  }
  
  // Credit type validation
  if (creditType && !['full', 'similarity_only'].includes(creditType)) {
    return { valid: false, error: "Invalid credit type" };
  }
  
  // Sanitize priceId if provided
  if (priceId && (typeof priceId !== 'string' || !priceId.startsWith('price_'))) {
    return { valid: false, error: "Invalid price ID format" };
  }
  
  return { valid: true };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check rate limit
    const withinRateLimit = await checkRateLimit(supabaseClient, user.id);
    if (!withinRateLimit) {
      logStep("Rate limit exceeded", { userId: user.id });
      return new Response(JSON.stringify({ 
        error: "Too many checkout attempts. Please wait before trying again." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      });
    }

    const requestBody = await req.json();
    const { priceId, credits, amount, mode = "payment", creditType = "full" } = requestBody;
    logStep("Request body parsed", { priceId, credits, amount, mode, creditType });

    // Validate input
    const validation = validateInput(requestBody);
    if (!validation.valid) {
      logStep("Validation failed", { error: validation.error });
      return new Response(JSON.stringify({ error: validation.error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Record rate limit attempt
    await recordRateLimit(supabaseClient, user.id);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    const origin = req.headers.get("origin") || "https://fyssbzgmhnolazjfwafm.lovableproject.com";
    
    // Get client info for fraud prevention
    const clientIp = req.headers.get("x-forwarded-for")?.split(',')[0]?.trim() || 
                     req.headers.get("x-real-ip") || 
                     "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    
    // Build line items
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
    
    if (priceId) {
      lineItems = [{ price: priceId, quantity: 1 }];
    } else {
      const creditLabel = creditType === "similarity_only" ? "Similarity" : "AI Scan";
      lineItems = [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${credits} ${creditLabel} Credits`,
            description: `Purchase of ${credits} ${creditLabel.toLowerCase()} credits`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }];
    }

    // STRICT 3D SECURE ENFORCEMENT
    // request_three_d_secure: "any" forces 3DS authentication for ALL cards
    // Cards that don't support 3DS will be rejected
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: lineItems,
      mode: mode as "payment" | "subscription",
      success_url: `${origin}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/credits?canceled=true`,
      metadata: {
        user_id: user.id,
        credits: credits?.toString() || "0",
        credit_type: creditType,
      },
      // MANDATORY 3DS enforcement on all card payments
      payment_method_options: {
        card: {
          request_three_d_secure: "any", // Force 3DS on ALL transactions - no exceptions
        },
      },
      // Fraud prevention metadata on payment intent
      ...(mode === "payment" && {
        payment_intent_data: {
          metadata: {
            user_id: user.id,
            credits: credits?.toString() || "0",
            credit_type: creditType,
            client_ip: clientIp.substring(0, 100), // Limit length
            user_agent: userAgent.substring(0, 200), // Limit length
            three_d_secure_required: "true", // Flag for tracking 3DS enforcement
          },
        },
      }),
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);
    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
