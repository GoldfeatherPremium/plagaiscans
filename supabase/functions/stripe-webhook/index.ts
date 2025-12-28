import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
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

  let eventId: string | null = null;

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

    eventId = event.id;
    logStep("Processing event", { type: event.type, id: event.id });

    // Store webhook event in database
    const { error: logError } = await supabaseAdmin
      .from("stripe_webhook_logs")
      .insert({
        event_id: event.id,
        event_type: event.type,
        payload: event,
        processed: false,
      });

    if (logError) {
      // Check if it's a duplicate event (unique constraint violation)
      if ((logError as any)?.code === "23505") {
        logStep("Duplicate event, already processed", { eventId: event.id });
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      logStep("Error logging webhook event", { error: logError });
    }

    let processed = true;
    let errorMessage: string | null = null;

    try {
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
          const amountTotal = (session.amount_total || 0) / 100; // Convert from cents

          if (!userId || !credits) {
            logStep("Missing metadata", { userId, credits });
            break;
          }

          // IDEMPOTENCY CHECK: ensure we only credit once per session
          const idempotencyKey = `stripe_webhook:${session.id}`;
          const { error: idemError } = await supabaseAdmin
            .from("payment_idempotency_keys")
            .insert({ key: idempotencyKey, provider: "stripe_webhook", user_id: userId });

          if (idemError) {
            if ((idemError as any)?.code === "23505") {
              logStep("Credits already added via webhook for this session", { sessionId: session.id });
              break;
            }
            throw idemError;
          }

          // Get current balance
          const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("credit_balance, email")
            .eq("id", userId)
            .single();

          if (profileError) {
            logStep("Error fetching profile", { error: profileError });
            throw profileError;
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
            throw updateError;
          }

          // Log the transaction
          await supabaseAdmin.from("credit_transactions").insert({
            user_id: userId,
            amount: credits,
            balance_before: currentBalance,
            balance_after: newBalance,
            transaction_type: "purchase",
            description: `Stripe webhook - Session: ${session.id.slice(-8)}`,
          });

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

          // Store in stripe_payments for customer receipts
          await supabaseAdmin.from("stripe_payments").insert({
            user_id: userId,
            session_id: session.id,
            payment_intent_id: session.payment_intent as string || null,
            amount_usd: amountTotal,
            credits: credits,
            status: "completed",
            customer_email: session.customer_email || profile?.email,
            receipt_url: receiptUrl,
            completed_at: new Date().toISOString(),
          });

          // Create notification
          await supabaseAdmin.from("user_notifications").insert({
            user_id: userId,
            title: "Payment Successful! 🎉",
            message: `Your payment was successful! ${credits} credits have been added to your account.`,
          });

          // Send push notification
          try {
            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
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
          } catch (pushError) {
            logStep("Failed to send push notification", { error: pushError });
          }

          logStep("Credits added successfully via webhook", { userId, credits, newBalance });
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

        case "charge.succeeded": {
          const charge = event.data.object as Stripe.Charge;
          logStep("Charge succeeded", { 
            id: charge.id,
            amount: charge.amount,
            receiptUrl: charge.receipt_url
          });

          // Update stripe_payments with receipt URL if session exists
          if (charge.payment_intent) {
            await supabaseAdmin
              .from("stripe_payments")
              .update({ receipt_url: charge.receipt_url })
              .eq("payment_intent_id", charge.payment_intent as string);
          }
          break;
        }

        default:
          logStep("Unhandled event type", { type: event.type });
      }
    } catch (processingError) {
      processed = false;
      errorMessage = processingError instanceof Error ? processingError.message : String(processingError);
      logStep("Error processing event", { error: errorMessage });
    }

    // Update webhook log with processing result
    await supabaseAdmin
      .from("stripe_webhook_logs")
      .update({ 
        processed, 
        error_message: errorMessage,
        processed_at: new Date().toISOString()
      })
      .eq("event_id", event.id);

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    // Try to update webhook log with error
    if (eventId) {
      await supabaseAdmin
        .from("stripe_webhook_logs")
        .update({ 
          processed: false, 
          error_message: errorMessage,
          processed_at: new Date().toISOString()
        })
        .eq("event_id", eventId);
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
