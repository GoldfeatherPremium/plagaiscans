import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-STRIPE-PAYMENT] ${step}${detailsStr}`);
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

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("Session ID is required");
    logStep("Session ID received", { sessionId });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logStep("Session retrieved", { status: session.payment_status, mode: session.mode });

    if (session.payment_status === "paid") {
      const credits = parseInt(session.metadata?.credits || "0");
      const userId = session.metadata?.user_id;

      if (credits > 0 && userId === user.id) {
        // Get current balance
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("credit_balance")
          .eq("id", userId)
          .single();

        if (profile) {
          const currentBalance = profile.credit_balance || 0;
          const newBalance = currentBalance + credits;

          // Update credits
          const { error: updateError } = await supabaseClient
            .from("profiles")
            .update({ credit_balance: newBalance })
            .eq("id", userId);

          if (updateError) throw updateError;

          // Log transaction
          await supabaseClient.from("credit_transactions").insert({
            user_id: userId,
            transaction_type: "purchase",
            amount: credits,
            balance_before: currentBalance,
            balance_after: newBalance,
            description: `Stripe payment - Session: ${sessionId.slice(-8)}`,
          });

          logStep("Credits added", { credits, newBalance });

          return new Response(JSON.stringify({
            success: true,
            creditsAdded: credits,
            newBalance,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          });
        }
      }
    }

    return new Response(JSON.stringify({
      success: false,
      status: session.payment_status,
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
