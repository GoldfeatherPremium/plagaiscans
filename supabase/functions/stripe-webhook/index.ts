import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    
    logStep("Received webhook request", { hasSignature: !!signature });

    let event: Stripe.Event;

    // Verify webhook signature if secret is configured
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        logStep("Webhook signature verified");
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logStep("Webhook signature verification failed", { error: errorMessage });
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // For testing without signature verification
      event = JSON.parse(body);
      logStep("Processing webhook without signature verification");
    }

    logStep("Processing event", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout session completed", { 
          sessionId: session.id, 
          customerEmail: session.customer_email,
          metadata: session.metadata 
        });

        // Get metadata from session
        const credits = parseInt(session.metadata?.credits || "0", 10);
        const userId = session.metadata?.user_id;

        if (!userId || !credits) {
          logStep("Missing metadata", { userId, credits });
          break;
        }

        // Get current balance
        const { data: profile, error: profileError } = await supabaseAdmin
          .from("profiles")
          .select("credit_balance, email")
          .eq("id", userId)
          .single();

        if (profileError) {
          logStep("Error fetching profile", { error: profileError });
          break;
        }

        const currentBalance = profile?.credit_balance || 0;
        const newBalance = currentBalance + credits;

        // Update credit balance
        const { error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({ credit_balance: newBalance })
          .eq("id", userId);

        if (updateError) {
          logStep("Error updating balance", { error: updateError });
          break;
        }

        // Log the transaction
        await supabaseAdmin.from("credit_transactions").insert({
          user_id: userId,
          amount: credits,
          balance_before: currentBalance,
          balance_after: newBalance,
          transaction_type: "purchase",
          description: `Stripe purchase - ${credits} credits`,
        });

        // Create notification
        await supabaseAdmin.from("user_notifications").insert({
          user_id: userId,
          title: "Payment Successful! 🎉",
          message: `Your payment was successful! ${credits} credits have been added to your account.`,
        });

        logStep("Credits added successfully", { userId, credits, newBalance });
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment intent succeeded", { 
          id: paymentIntent.id,
          amount: paymentIntent.amount,
          metadata: paymentIntent.metadata
        });
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment failed", { 
          id: paymentIntent.id,
          error: paymentIntent.last_payment_error?.message
        });
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
