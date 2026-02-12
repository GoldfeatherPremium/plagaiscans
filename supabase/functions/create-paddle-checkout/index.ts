import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PADDLE-CHECKOUT] ${step}${detailsStr}`);
};

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

    const paddleApiKey = Deno.env.get("PADDLE_API_KEY");
    if (!paddleApiKey) throw new Error("PADDLE_API_KEY is not set");

    // Get Paddle environment from settings table
    const { data: envSetting } = await supabaseClient
      .from("settings")
      .select("value")
      .eq("key", "paddle_environment")
      .single();

    const paddleEnv = envSetting?.value || "sandbox";
    const paddleBaseUrl = paddleEnv === "production"
      ? "https://api.paddle.com"
      : "https://sandbox-api.paddle.com";

    logStep("Paddle environment", { paddleEnv, paddleBaseUrl });

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const requestBody = await req.json();
    const { priceId, credits, amount, creditType = "full" } = requestBody;
    logStep("Request body", { priceId, credits, amount, creditType });

    // Validate input
    if (!priceId) {
      return new Response(JSON.stringify({ error: "Paddle price ID is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (!credits || credits <= 0) {
      return new Response(JSON.stringify({ error: "Credits must be positive" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get or create Paddle customer
    let paddleCustomerId: string | null = null;

    // Search for existing customer by email
    const customerSearchRes = await fetch(`${paddleBaseUrl}/customers?email=${encodeURIComponent(user.email)}`, {
      headers: {
        "Authorization": `Bearer ${paddleApiKey}`,
        "Content-Type": "application/json",
      },
    });

    const customerSearchData = await customerSearchRes.json();
    if (customerSearchData.data?.length > 0) {
      paddleCustomerId = customerSearchData.data[0].id;
      logStep("Found existing Paddle customer", { paddleCustomerId });
    } else {
      // Create new customer
      const createCustomerRes = await fetch(`${paddleBaseUrl}/customers`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paddleApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          name: user.user_metadata?.full_name || user.email,
        }),
      });

      const createCustomerData = await createCustomerRes.json();
      if (createCustomerData.data?.id) {
        paddleCustomerId = createCustomerData.data.id;
        logStep("Created new Paddle customer", { paddleCustomerId });
      }
    }

    // Create a transaction
    const origin = req.headers.get("origin") || "https://plagaiscans.lovable.app";

    const transactionPayload: any = {
      items: [
        {
          price_id: priceId,
          quantity: 1,
        },
      ],
      custom_data: {
        user_id: user.id,
        credits: credits.toString(),
        credit_type: creditType,
      },
      checkout: {
        url: `${origin}/dashboard/payment-success?provider=paddle`,
      },
    };

    if (paddleCustomerId) {
      transactionPayload.customer_id = paddleCustomerId;
    }

    const transactionRes = await fetch(`${paddleBaseUrl}/transactions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paddleApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(transactionPayload),
    });

    const transactionData = await transactionRes.json();
    logStep("Transaction response", { status: transactionRes.status });

    if (!transactionRes.ok) {
      logStep("Transaction creation failed", { error: transactionData });
      throw new Error(transactionData.error?.detail || "Failed to create Paddle transaction");
    }

    const transactionId = transactionData.data?.id;
    logStep("Transaction created", { transactionId });

    return new Response(JSON.stringify({
      transactionId,
      paddleCustomerId,
    }), {
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
