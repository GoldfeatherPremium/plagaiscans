import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, paddle-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PADDLE-WEBHOOK] ${step}${detailsStr}`);
};

// Verify Paddle webhook signature
async function verifySignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret) return false;

  try {
    // Paddle signature format: ts=timestamp;h1=hash
    const parts: Record<string, string> = {};
    for (const part of signature.split(';')) {
      const [key, value] = part.split('=');
      if (key && value) parts[key] = value;
    }

    const ts = parts['ts'];
    const h1 = parts['h1'];
    if (!ts || !h1) return false;

    const signedPayload = `${ts}:${rawBody}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
    const computedHash = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return computedHash === h1;
  } catch (e) {
    logStep("Signature verification error", { error: e });
    return false;
  }
}

// Helper: send push notification
async function sendPushNotification(userId: string, title: string, body: string, data?: any) {
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-push-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ userId, title, body, data }),
    });
  } catch (e) {
    logStep("Failed to send push notification", { error: e });
  }
}

// Helper: notify admin about payment
async function notifyAdminPayment(params: {
  customerEmail: string; customerName: string; amount: number;
  credits: number; paymentMethod: string; transactionId?: string;
  creditType?: string; currency?: string;
}) {
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-admin-payment-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify(params),
    });
  } catch (e) {
    logStep("Failed to send admin payment notification", { error: e });
  }
}

async function createUserNotification(userId: string, title: string, message: string) {
  await supabaseAdmin.from("user_notifications").insert({ user_id: userId, title, message });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("paddle-signature");
    const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET") || "";

    logStep("Received webhook", { hasSignature: !!signature });

    // Verify signature
    if (webhookSecret && signature) {
      const isValid = await verifySignature(rawBody, signature, webhookSecret);
      if (!isValid) {
        logStep("Signature verification failed");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      logStep("Signature verified");
    }

    const event = JSON.parse(rawBody);
    const eventId = event.event_id || event.notification_id || `paddle_${Date.now()}`;
    const eventType = event.event_type || "unknown";

    logStep("Processing event", { eventType, eventId });

    // Store webhook event
    const { error: logError } = await supabaseAdmin
      .from("paddle_webhook_logs")
      .insert({
        event_id: eventId,
        event_type: eventType,
        payload: event,
        processed: false,
      });

    if (logError) {
      if ((logError as any)?.code === "23505") {
        logStep("Duplicate event", { eventId });
        return new Response(JSON.stringify({ received: true, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      logStep("Error logging webhook", { error: logError });
    }

    let processed = true;
    let errorMessage: string | null = null;

    try {
      const eventData = event.data;

      switch (eventType) {
        case "transaction.completed": {
          logStep("Transaction completed", { transactionId: eventData?.id });

          const customData = eventData?.custom_data || {};
          const userId = customData.user_id;
          const credits = parseInt(customData.credits || "0", 10);
          const creditType = customData.credit_type || "full";
          const transactionId = eventData?.id;
          const paddleCustomerId = eventData?.customer_id;

          if (!userId || !credits) {
            logStep("Missing custom_data", { userId, credits });
            break;
          }

          // Calculate amount and tax from transaction details
          const totals = eventData?.details?.totals;
          const taxRatesUsed = eventData?.details?.tax_rates_used;
          const amountTotal = totals?.total
            ? parseFloat(totals.total) / 100
            : 0;
          const subtotalAmount = totals?.subtotal ? parseFloat(totals.subtotal) / 100 : amountTotal;
          const taxAmount = totals?.tax ? parseFloat(totals.tax) / 100 : 0;
          const taxRate = taxRatesUsed?.[0]?.tax_rate ? parseFloat(taxRatesUsed[0].tax_rate) * 100 : 0;

          logStep("Tax data extracted", { subtotalAmount, taxAmount, taxRate, amountTotal });

          // Idempotency check
          const idempotencyKey = `paddle_webhook:${transactionId}`;
          const { error: idemError } = await supabaseAdmin
            .from("payment_idempotency_keys")
            .insert({ key: idempotencyKey, provider: "paddle_webhook", user_id: userId });

          if (idemError) {
            if ((idemError as any)?.code === "23505") {
              logStep("Credits already added", { transactionId });
              break;
            }
            throw idemError;
          }

          // Get current balance
          const balanceField = creditType === "similarity_only" ? "similarity_credit_balance" : "credit_balance";
          const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select(`${balanceField}, email`)
            .eq("id", userId)
            .single();

          if (profileError) throw profileError;

          const currentBalance = (profile as any)?.[balanceField] || 0;
          const newBalance = currentBalance + credits;

          // Update balance
          await supabaseAdmin
            .from("profiles")
            .update({ [balanceField]: newBalance })
            .eq("id", userId);

          // Log transaction
          await supabaseAdmin.from("credit_transactions").insert({
            user_id: userId,
            amount: credits,
            balance_before: currentBalance,
            balance_after: newBalance,
            transaction_type: "purchase",
            credit_type: creditType,
            description: `Paddle payment - ${creditType === "similarity_only" ? "Similarity" : "Full"} Credits - Txn: ${transactionId?.slice(-8)}`,
          });

          // Store in paddle_payments
          const paddleCurrency = (eventData?.currency_code || 'USD').toUpperCase();
          await supabaseAdmin.from("paddle_payments").insert({
            user_id: userId,
            transaction_id: transactionId,
            paddle_customer_id: paddleCustomerId,
            amount_usd: amountTotal,
            credits,
            credit_type: creditType,
            status: "completed",
            customer_email: profile?.email,
            completed_at: new Date().toISOString(),
            currency: paddleCurrency,
          });

          // Create invoice
          try {
            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/create-invoice`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                user_id: userId,
                amount_usd: amountTotal,
                credits,
                payment_type: 'paddle',
                payment_id: transactionId,
                customer_email: profile?.email,
                description: `${credits} Document Check Credits`,
                currency: paddleCurrency,
                status: 'paid',
                subtotal: subtotalAmount,
                vat_amount: taxAmount,
                vat_rate: taxRate,
              }),
            });
          } catch (e) {
            logStep("Error creating invoice", { error: e });
          }

          // Create receipt
          try {
            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/create-receipt`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                userId,
                customerEmail: profile?.email,
                description: `${credits} Document Check Credits`,
                quantity: credits,
                unitPrice: credits > 0 ? subtotalAmount / credits : 0,
                subtotal: subtotalAmount,
                vatRate: taxRate,
                vatAmount: taxAmount,
                amountPaid: amountTotal,
                currency: paddleCurrency,
                paymentMethod: 'Paddle',
                transactionId,
                paymentId: transactionId,
                credits,
              }),
            });
          } catch (e) {
            logStep("Error creating receipt", { error: e });
          }

          // Notify user
          const creditLabel = creditType === "similarity_only" ? "Similarity" : "AI Scan";
          await createUserNotification(userId, "Payment Successful! 🎉",
            `Your payment was successful! ${credits} ${creditLabel} credits have been added to your account.`);

          await sendPushNotification(userId, 'Payment Successful! 💳',
            `${credits} credits have been added to your account.`, { type: 'payment_success', url: '/dashboard' });

          // Notify admin about this payment
          await notifyAdminPayment({
            customerEmail: profile?.email || '',
            customerName: profile?.email?.split('@')[0] || 'Customer',
            amount: amountTotal,
            credits,
            paymentMethod: 'paddle',
            transactionId,
            creditType,
            currency: paddleCurrency,
          });

          // Credit validity
          try {
            const { data: packageData } = await supabaseAdmin
              .from("pricing_packages")
              .select("validity_days")
              .eq("paddle_price_id", eventData?.items?.[0]?.price?.id)
              .single();

            const validityDays = packageData?.validity_days || 365;
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + validityDays);

            await supabaseAdmin.from("credit_validity").insert({
              user_id: userId,
              credits_amount: credits,
              remaining_credits: credits,
              expires_at: expiresAt.toISOString(),
              credit_type: creditType,
            });
          } catch (e) {
            logStep("Error creating credit validity", { error: e });
          }

          logStep("Credits added", { userId, credits, newBalance });
          break;
        }

        case "subscription.created": {
          const subData = eventData;
          logStep("Subscription created", { subscriptionId: subData?.id });

          const customData = subData?.custom_data || {};
          const userId = customData.user_id;

          if (userId) {
            await supabaseAdmin.from("paddle_subscriptions").insert({
              user_id: userId,
              subscription_id: subData.id,
              paddle_customer_id: subData.customer_id,
              product_id: subData.items?.[0]?.product?.id,
              price_id: subData.items?.[0]?.price?.id,
              status: subData.status || "active",
              current_period_start: subData.current_billing_period?.starts_at,
              current_period_end: subData.current_billing_period?.ends_at,
            });

            await createUserNotification(userId, "Subscription Active! 🎉",
              "Your subscription is now active. Credits will be added automatically each billing period.");
          }
          break;
        }

        case "subscription.updated": {
          const subData = eventData;
          logStep("Subscription updated", { subscriptionId: subData?.id });

          await supabaseAdmin
            .from("paddle_subscriptions")
            .update({
              status: subData.status,
              current_period_start: subData.current_billing_period?.starts_at,
              current_period_end: subData.current_billing_period?.ends_at,
              updated_at: new Date().toISOString(),
            })
            .eq("subscription_id", subData.id);
          break;
        }

        case "subscription.canceled": {
          const subData = eventData;
          logStep("Subscription canceled", { subscriptionId: subData?.id });

          await supabaseAdmin
            .from("paddle_subscriptions")
            .update({
              status: "canceled",
              canceled_at: subData.canceled_at || new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("subscription_id", subData.id);

          // Notify user
          const { data: sub } = await supabaseAdmin
            .from("paddle_subscriptions")
            .select("user_id")
            .eq("subscription_id", subData.id)
            .single();

          if (sub?.user_id) {
            await createUserNotification(sub.user_id, "Subscription Canceled",
              "Your subscription has been canceled. You can still use your remaining credits.");
          }
          break;
        }

        case "transaction.payment_failed": {
          logStep("Payment failed", { transactionId: eventData?.id });

          const customData = eventData?.custom_data || {};
          const userId = customData.user_id;

          if (userId) {
            await createUserNotification(userId, "Payment Failed ❌",
              "Your recent payment attempt failed. Please try again or use a different payment method.");

            await sendPushNotification(userId, 'Payment Failed ❌',
              'Your payment could not be processed. Please try again.',
              { type: 'payment_failed', url: '/dashboard/credits' });
          }
          break;
        }

        default:
          logStep("Unhandled event type", { eventType });
          break;
      }
    } catch (processError) {
      processed = false;
      errorMessage = processError instanceof Error ? processError.message : String(processError);
      logStep("Processing error", { error: errorMessage });
    }

    // Update webhook log status
    await supabaseAdmin
      .from("paddle_webhook_logs")
      .update({
        processed,
        error_message: errorMessage,
        processed_at: new Date().toISOString(),
      })
      .eq("event_id", eventId);

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("FATAL ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
