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
        // IDEMPOTENCY CHECK: ensure we only credit once per Stripe session
        const idempotencyKey = `stripe_session:${sessionId}`;
        const { error: idemInsertError } = await supabaseClient
          .from("payment_idempotency_keys")
          .insert({ key: idempotencyKey, provider: "stripe", user_id: userId });

        // Postgres unique violation means we've already processed this session
        if (idemInsertError) {
          const maybeCode = (idemInsertError as any)?.code;
          if (maybeCode === "23505") {
            logStep("Credits already added for this session", { sessionId });

            const { data: profile } = await supabaseClient
              .from("profiles")
              .select("credit_balance")
              .eq("id", userId)
              .single();

            return new Response(
              JSON.stringify({
                success: true,
                creditsAdded: credits,
                newBalance: profile?.credit_balance || 0,
                alreadyProcessed: true,
              }),
              {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
              }
            );
          }

          // Unexpected DB error
          throw idemInsertError;
        }

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

          // Get receipt URL if available
          let receiptUrl: string | null = null;
          if (session.payment_intent) {
            try {
              const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string, {
                expand: ['latest_charge'],
              });
              const charge = paymentIntent.latest_charge as Stripe.Charge;
              receiptUrl = charge?.receipt_url || null;
            } catch (e) {
              logStep("Could not retrieve receipt URL", { error: e });
            }
          }

          // Store in stripe_payments for customer receipts (upsert to handle webhook race)
          await supabaseClient.from("stripe_payments").upsert({
            user_id: userId,
            session_id: sessionId,
            payment_intent_id: session.payment_intent as string || null,
            amount_usd: parseFloat(session.metadata?.amount_usd || String((session.amount_total || 0) / 100)),
            credits: credits,
            status: "completed",
            customer_email: session.customer_email || user.email,
            receipt_url: receiptUrl,
            completed_at: new Date().toISOString(),
          }, { onConflict: 'session_id' });

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

          // Get user email for notification
          const { data: userProfile } = await supabaseClient
            .from("profiles")
            .select("email, full_name")
            .eq("id", userId)
            .single();

          // Send payment confirmation email
          try {
            const emailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-payment-confirmation-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                userId: userId,
                credits: credits,
                amount: parseFloat(session.metadata?.amount_usd || "0"),
                paymentMethod: 'Stripe Card Payment',
                transactionId: sessionId.slice(-12),
              }),
            });
            logStep("Payment confirmation email sent", { status: emailResponse.status });
          } catch (emailError) {
            logStep("Failed to send confirmation email", { error: emailError });
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
                userId: userId,
                title: 'Payment Successful! 💳',
                body: `${credits} credits have been added to your account.`,
                data: { type: 'payment_success', url: '/dashboard' },
              }),
            });
            logStep("Push notification sent", { status: pushResponse.status });
          } catch (pushError) {
            logStep("Failed to send push notification", { error: pushError });
          }

          // Create in-app notification
          await supabaseClient.from("user_notifications").insert({
            user_id: userId,
            title: "✅ Payment Successful",
            message: `Your Stripe payment was successful! ${credits} credits have been added to your account.`,
          });

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
