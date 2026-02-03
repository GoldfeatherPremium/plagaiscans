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

// Helper to find user by payment intent
async function findUserByPaymentIntent(paymentIntentId: string): Promise<{ userId: string | null; credits: number }> {
  const { data: payment } = await supabaseAdmin
    .from("stripe_payments")
    .select("user_id, credits")
    .eq("payment_intent_id", paymentIntentId)
    .single();
  
  return { userId: payment?.user_id || null, credits: payment?.credits || 0 };
}

// Helper to find user by charge
async function findUserByCharge(chargeId: string): Promise<{ userId: string | null; credits: number; paymentIntentId: string | null }> {
  // First try to get payment intent from charge
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    if (charge.payment_intent) {
      const { data: payment } = await supabaseAdmin
        .from("stripe_payments")
        .select("user_id, credits")
        .eq("payment_intent_id", charge.payment_intent as string)
        .single();
      
      return { 
        userId: payment?.user_id || null, 
        credits: payment?.credits || 0,
        paymentIntentId: charge.payment_intent as string
      };
    }
  } catch (e) {
    logStep("Error retrieving charge", { error: e });
  }
  return { userId: null, credits: 0, paymentIntentId: null };
}

// Helper to send push notification
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

// Helper to create user notification
async function createUserNotification(userId: string, title: string, message: string) {
  await supabaseAdmin.from("user_notifications").insert({ user_id: userId, title, message });
}

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
        // IMPORTANT: Use constructEventAsync for Deno environments
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
        logStep("Webhook signature verified successfully");
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
          const creditType = session.metadata?.credit_type || "full";
          const amountTotal = (session.amount_total || 0) / 100;

          if (!userId || !credits) {
            logStep("Missing metadata", { userId, credits });
            break;
          }

          // IDEMPOTENCY CHECK
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

          // Get current balance based on credit type
          const balanceField = creditType === "similarity_only" ? "similarity_credit_balance" : "credit_balance";
          const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select(`${balanceField}, email`)
            .eq("id", userId)
            .single();

          if (profileError) {
            logStep("Error fetching profile", { error: profileError });
            throw profileError;
          }

          const currentBalance = (profile as any)?.[balanceField] || 0;
          const newBalance = currentBalance + credits;

          // Update credit balance
          const { error: updateError } = await supabaseAdmin
            .from("profiles")
            .update({ [balanceField]: newBalance })
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
            credit_type: creditType,
            description: `Stripe webhook - ${creditType === "similarity_only" ? "Similarity" : "Full"} Credits - Session: ${session.id.slice(-8)}`,
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

          // Store in stripe_payments
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

          // Get charge ID for receipt records
          let chargeId: string | null = null;
          if (session.payment_intent) {
            try {
              const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string, {
                expand: ['latest_charge'],
              });
              const charge = paymentIntent.latest_charge as Stripe.Charge;
              chargeId = charge?.id || null;
            } catch (e) {
              logStep("Could not retrieve charge ID", { error: e });
            }
          }

          // Auto-generate invoice with Stripe receipt URL
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
                credits: credits,
                payment_type: 'stripe',
                payment_id: session.id,
                transaction_id: session.payment_intent as string || null,
                customer_email: session.customer_email || profile?.email,
                description: `${credits} Document Check Credits`,
                currency: (session.currency || 'usd').toUpperCase(),
                status: 'paid',
                stripe_receipt_url: receiptUrl,
              }),
            });
          } catch (invoiceError) {
            logStep("Error creating invoice", { error: invoiceError });
          }

          // Auto-generate receipt with Stripe receipt URL and charge ID
          try {
            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/create-receipt`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                userId: userId,
                customerName: session.customer_details?.name || null,
                customerEmail: session.customer_email || profile?.email,
                customerCountry: session.customer_details?.address?.country || null,
                description: `${credits} Document Check Credits`,
                quantity: credits,
                unitPrice: amountTotal / credits,
                subtotal: amountTotal,
                vatRate: 0,
                vatAmount: 0,
                amountPaid: amountTotal,
                currency: (session.currency || 'usd').toUpperCase(),
                paymentMethod: 'Stripe',
                transactionId: session.payment_intent as string || null,
                paymentId: session.id,
                credits: credits,
                stripe_receipt_url: receiptUrl,
                stripe_charge_id: chargeId,
              }),
            });
          } catch (receiptError) {
            logStep("Error creating receipt", { error: receiptError });
          }

          // Create notification
          const creditTypeLabel = creditType === "similarity_only" ? "Similarity" : "AI Scan";
          await createUserNotification(userId, "Payment Successful! 🎉", 
            `Your payment was successful! ${credits} ${creditTypeLabel} credits have been added to your account.`);

          await sendPushNotification(userId, 'Payment Successful! 💳', 
            `${credits} credits have been added to your account.`, { type: 'payment_success', url: '/dashboard' });

          logStep("Credits added successfully via webhook", { userId, credits, newBalance });
          break;
        }

        case "charge.refunded": {
          const charge = event.data.object as Stripe.Charge;
          logStep("Charge refunded", { chargeId: charge.id, amount: charge.amount_refunded });

          const { userId, credits, paymentIntentId } = await findUserByCharge(charge.id);
          
          if (!userId) {
            logStep("Could not find user for refunded charge", { chargeId: charge.id });
            break;
          }

          // Calculate credits to deduct (proportional to refund)
          const refundRatio = charge.amount_refunded / charge.amount;
          const creditsToDeduct = Math.ceil(credits * refundRatio);

          // Get the latest refund
          const refunds = charge.refunds?.data || [];
          const latestRefund = refunds[0];

          if (latestRefund) {
            // Check if refund already recorded
            const { data: existingRefund } = await supabaseAdmin
              .from("stripe_refunds")
              .select("id")
              .eq("refund_id", latestRefund.id)
              .single();

            if (!existingRefund) {
              // Get current balance
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("credit_balance")
                .eq("id", userId)
                .single();

              const currentBalance = profile?.credit_balance || 0;
              const newBalance = Math.max(0, currentBalance - creditsToDeduct);

              // Deduct credits
              await supabaseAdmin
                .from("profiles")
                .update({ credit_balance: newBalance })
                .eq("id", userId);

              // Log transaction
              await supabaseAdmin.from("credit_transactions").insert({
                user_id: userId,
                amount: -creditsToDeduct,
                balance_before: currentBalance,
                balance_after: newBalance,
                transaction_type: "refund",
                description: `Stripe refund - ${creditsToDeduct} credits deducted - Refund: ${latestRefund.id.slice(-8)}`,
              });

              // Record refund
              await supabaseAdmin.from("stripe_refunds").insert({
                user_id: userId,
                payment_intent_id: paymentIntentId || charge.payment_intent as string,
                refund_id: latestRefund.id,
                amount_cents: latestRefund.amount,
                credits_deducted: creditsToDeduct,
                reason: latestRefund.reason || 'requested_by_customer',
                status: 'completed',
                processed_at: new Date().toISOString(),
              });

              // Update stripe_payments status
              if (paymentIntentId) {
                await supabaseAdmin
                  .from("stripe_payments")
                  .update({ status: charge.refunded ? 'refunded' : 'partially_refunded' })
                  .eq("payment_intent_id", paymentIntentId);
              }

              // Notify user
              await createUserNotification(userId, "Refund Processed 💸",
                `A refund of $${(latestRefund.amount / 100).toFixed(2)} has been processed. ${creditsToDeduct} credits have been deducted from your account.`);

              await sendPushNotification(userId, 'Refund Processed 💸',
                `$${(latestRefund.amount / 100).toFixed(2)} refunded, ${creditsToDeduct} credits deducted.`, 
                { type: 'refund', url: '/dashboard/payments' });

              logStep("Refund processed", { userId, creditsDeducted: creditsToDeduct, refundId: latestRefund.id });
            }
          }
          break;
        }

        case "charge.dispute.created": {
          const dispute = event.data.object as Stripe.Dispute;
          logStep("Dispute created", { disputeId: dispute.id, chargeId: dispute.charge, amount: dispute.amount });

          const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
          const { userId } = await findUserByCharge(chargeId || '');

          // Record dispute
          await supabaseAdmin.from("stripe_disputes").insert({
            user_id: userId,
            charge_id: chargeId || '',
            dispute_id: dispute.id,
            amount_cents: dispute.amount,
            reason: dispute.reason,
            status: dispute.status,
            evidence_due_by: dispute.evidence_details?.due_by 
              ? new Date(dispute.evidence_details.due_by * 1000).toISOString() 
              : null,
          });

          // Notify admins via user_notifications (admin will see in their dashboard)
          const { data: admins } = await supabaseAdmin
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin");

          for (const admin of admins || []) {
            await createUserNotification(admin.user_id, "⚠️ Chargeback Alert",
              `A dispute for $${(dispute.amount / 100).toFixed(2)} has been opened. Reason: ${dispute.reason}. Evidence due: ${dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString() : 'N/A'}`);
          }

          logStep("Dispute recorded and admins notified", { disputeId: dispute.id });
          break;
        }

        case "charge.dispute.closed": {
          const dispute = event.data.object as Stripe.Dispute;
          logStep("Dispute closed", { disputeId: dispute.id, status: dispute.status });

          await supabaseAdmin
            .from("stripe_disputes")
            .update({ 
              status: dispute.status, 
              resolved_at: new Date().toISOString() 
            })
            .eq("dispute_id", dispute.id);

          logStep("Dispute status updated", { disputeId: dispute.id, status: dispute.status });
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          logStep("Subscription updated", { 
            subscriptionId: subscription.id, 
            status: subscription.status,
            customerId: subscription.customer 
          });

          // Get user by customer email
          const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
          if (customerId) {
            const customer = await stripe.customers.retrieve(customerId);
            if ('email' in customer && customer.email) {
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("id")
                .eq("email", customer.email)
                .single();

              if (profile) {
                await createUserNotification(profile.id, "Subscription Updated 📋",
                  `Your subscription has been updated. Status: ${subscription.status}`);
              }
            }
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          logStep("Subscription cancelled", { subscriptionId: subscription.id });

          const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
          if (customerId) {
            const customer = await stripe.customers.retrieve(customerId);
            if ('email' in customer && customer.email) {
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("id")
                .eq("email", customer.email)
                .single();

              if (profile) {
                await createUserNotification(profile.id, "Subscription Cancelled ❌",
                  `Your subscription has been cancelled. You can resubscribe anytime from your dashboard.`);

                await sendPushNotification(profile.id, 'Subscription Cancelled',
                  'Your subscription has been cancelled.', { type: 'subscription_cancelled', url: '/dashboard/subscription' });
              }
            }
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          logStep("Invoice payment failed", { invoiceId: invoice.id, customerId: invoice.customer });

          const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
          if (customerId) {
            const customer = await stripe.customers.retrieve(customerId);
            if ('email' in customer && customer.email) {
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("id")
                .eq("email", customer.email)
                .single();

              if (profile) {
                await createUserNotification(profile.id, "Payment Failed ⚠️",
                  `Your payment of $${((invoice.amount_due || 0) / 100).toFixed(2)} failed. Please update your payment method to avoid service interruption.`);

                await sendPushNotification(profile.id, 'Payment Failed ⚠️',
                  'Please update your payment method.', { type: 'payment_failed', url: '/dashboard/subscription' });
              }
            }
          }
          break;
        }

        case "invoice.paid": {
          const invoice = event.data.object as Stripe.Invoice;
          logStep("Invoice paid", { 
            invoiceId: invoice.id, 
            subscriptionId: invoice.subscription,
            amountPaid: invoice.amount_paid,
            hostedUrl: invoice.hosted_invoice_url
          });

          // Only process subscription invoices
          if (!invoice.subscription) {
            logStep("Skipping non-subscription invoice");
            break;
          }

          // Get user from customer email
          const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
          if (!customerId) {
            logStep("No customer ID in invoice");
            break;
          }

          const customer = await stripe.customers.retrieve(customerId);
          if (!('email' in customer) || !customer.email) {
            logStep("No email found for customer");
            break;
          }

          const userEmail = customer.email;
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("id, email, full_name")
            .eq("email", userEmail)
            .single();

          if (!profile) {
            logStep("No profile found for email", { email: userEmail });
            break;
          }

          // Get subscription metadata for credits
          const subscriptionId = typeof invoice.subscription === 'string' 
            ? invoice.subscription 
            : invoice.subscription?.id;
          
          let subscriptionCredits = 0;
          if (subscriptionId) {
            try {
              const subscription = await stripe.subscriptions.retrieve(subscriptionId);
              subscriptionCredits = parseInt(subscription.metadata?.credits || "0");
            } catch (e) {
              logStep("Could not retrieve subscription", { error: e });
            }
          }

          const amountPaid = (invoice.amount_paid || 0) / 100;

          // Create invoice with Stripe URLs
          try {
            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/create-invoice`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                user_id: profile.id,
                amount_usd: amountPaid,
                credits: subscriptionCredits,
                payment_type: 'stripe_subscription',
                payment_id: invoice.id,
                transaction_id: invoice.charge as string || null,
                customer_email: userEmail,
                customer_name: profile.full_name || customer.name,
                description: `Subscription renewal - ${subscriptionCredits} credits`,
                currency: (invoice.currency || 'usd').toUpperCase(),
                status: 'paid',
                stripe_invoice_id: invoice.id,
                stripe_invoice_url: invoice.hosted_invoice_url || null,
                stripe_receipt_url: null, // Subscription invoices use invoice URL instead
              }),
            });
            logStep("Invoice created for subscription payment");
          } catch (invoiceError) {
            logStep("Error creating invoice for subscription", { error: invoiceError });
          }

          // Create receipt with Stripe charge receipt URL
          let chargeReceiptUrl: string | null = null;
          if (invoice.charge) {
            try {
              const chargeId = typeof invoice.charge === 'string' ? invoice.charge : invoice.charge.id;
              const chargeData = await stripe.charges.retrieve(chargeId);
              chargeReceiptUrl = chargeData.receipt_url || null;
            } catch (e) {
              logStep("Could not retrieve charge receipt URL", { error: e });
            }
          }

          try {
            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/create-receipt`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                userId: profile.id,
                customerName: profile.full_name || customer.name,
                customerEmail: userEmail,
                description: `Subscription renewal - ${subscriptionCredits} credits`,
                quantity: subscriptionCredits || 1,
                unitPrice: subscriptionCredits > 0 ? amountPaid / subscriptionCredits : amountPaid,
                subtotal: amountPaid,
                vatRate: 0,
                vatAmount: 0,
                amountPaid: amountPaid,
                currency: (invoice.currency || 'usd').toUpperCase(),
                paymentMethod: 'Stripe Subscription',
                transactionId: invoice.charge as string || null,
                paymentId: invoice.id,
                credits: subscriptionCredits,
                stripe_receipt_url: chargeReceiptUrl,
                stripe_charge_id: invoice.charge as string || null,
              }),
            });
            logStep("Receipt created for subscription payment");
          } catch (receiptError) {
            logStep("Error creating receipt for subscription", { error: receiptError });
          }

          // Notify user
          await createUserNotification(profile.id, "Subscription Payment Successful 🎉",
            `Your subscription payment of $${amountPaid.toFixed(2)} was successful.${subscriptionCredits > 0 ? ` ${subscriptionCredits} credits have been renewed.` : ''}`);

          await sendPushNotification(profile.id, 'Subscription Renewed 🎉',
            `Your subscription payment was successful.`, { type: 'subscription_renewed', url: '/dashboard/subscription' });

          logStep("Subscription invoice processed", { userId: profile.id, amountPaid, credits: subscriptionCredits });
          break;
        }

        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          
          // STRICT 3DS VERIFICATION - Log authentication status
          const charge = paymentIntent.latest_charge as Stripe.Charge | null;
          let threeDSecureStatus = 'unknown';
          let threeDSecureVersion = null;
          let authenticationFlow = null;
          
          if (charge && typeof charge !== 'string') {
            const threeDSecureDetails = charge.payment_method_details?.card?.three_d_secure;
            threeDSecureStatus = threeDSecureDetails?.result || 'not_supported';
            threeDSecureVersion = threeDSecureDetails?.version || null;
            authenticationFlow = threeDSecureDetails?.authentication_flow || null;
          }
          
          logStep("Payment intent succeeded with 3DS verification", { 
            id: paymentIntent.id,
            amount: paymentIntent.amount,
            metadata: paymentIntent.metadata,
            threeDSecureStatus,
            threeDSecureVersion,
            authenticationFlow,
            // Security: Log if 3DS was properly enforced
            threeDSecureEnforced: threeDSecureStatus === 'authenticated' || threeDSecureStatus === 'attempt_acknowledged'
          });
          
          // SECURITY WARNING: Log if payment succeeded without proper 3DS
          if (threeDSecureStatus === 'not_supported') {
            logStep("⚠️ SECURITY WARNING: Payment succeeded without 3DS support", {
              paymentIntentId: paymentIntent.id,
              threeDSecureStatus,
              // This should not happen with proper Radar rules in place
              recommendation: "Verify Stripe Radar rule: Block if :three_d_secure: = 'not_supported'"
            });
          }
          break;
        }

        case "payment_intent.requires_action": {
          // This event fires when 3DS authentication is required
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          logStep("Payment requires 3DS authentication action", { 
            id: paymentIntent.id,
            amount: paymentIntent.amount,
            status: paymentIntent.status,
            nextAction: paymentIntent.next_action?.type,
            userId: paymentIntent.metadata?.user_id
          });
          
          // Optionally notify user that 3DS is required
          const userId = paymentIntent.metadata?.user_id;
          if (userId) {
            await createUserNotification(userId, "Authentication Required 🔐",
              "Your payment requires additional authentication. Please complete the 3D Secure verification to proceed.");
          }
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          
          // Determine if failure was due to 3DS
          const errorCode = paymentIntent.last_payment_error?.code;
          const errorMessage = paymentIntent.last_payment_error?.message;
          const declineCode = paymentIntent.last_payment_error?.decline_code;
          
          // Check for 3DS-specific failures
          const is3DSFailure = 
            errorCode === 'authentication_required' ||
            errorCode === 'card_declined' && declineCode === 'authentication_required' ||
            errorMessage?.toLowerCase().includes('3d secure') ||
            errorMessage?.toLowerCase().includes('authentication');
          
          logStep("Payment failed", { 
            id: paymentIntent.id,
            errorCode,
            errorMessage,
            declineCode,
            is3DSFailure,
            // Log if this was an expected rejection (card doesn't support 3DS)
            rejectionReason: is3DSFailure ? '3DS authentication failed or not supported' : 'Other payment failure'
          });

          // Try to notify user with specific 3DS guidance
          const userId = paymentIntent.metadata?.user_id;
          if (userId) {
            if (is3DSFailure) {
              await createUserNotification(userId, "Payment Authentication Failed ⚠️",
                `Your payment could not be authenticated. This may be because your card doesn't support 3D Secure, or the authentication was cancelled. Please try a different card that supports 3D Secure authentication.`);
              
              await sendPushNotification(userId, 'Payment Authentication Failed ⚠️',
                'Your card may not support 3D Secure. Try a different card.', 
                { type: 'payment_failed', url: '/dashboard/credits' });
            } else {
              await createUserNotification(userId, "Payment Failed ⚠️",
                `Your payment attempt failed: ${errorMessage || 'Unknown error'}. Please try again.`);
            }
          }
          break;
        }

        case "charge.succeeded": {
          const charge = event.data.object as Stripe.Charge;
          logStep("Charge succeeded", { 
            id: charge.id,
            amount: charge.amount,
            receiptUrl: charge.receipt_url
          });

          // Update stripe_payments with receipt URL
          if (charge.payment_intent) {
            await supabaseAdmin
              .from("stripe_payments")
              .update({ receipt_url: charge.receipt_url })
              .eq("payment_intent_id", charge.payment_intent as string);
          }

          // Also update receipts table with Stripe receipt URL
          if (charge.receipt_url) {
            await supabaseAdmin
              .from("receipts")
              .update({ 
                stripe_receipt_url: charge.receipt_url,
                stripe_charge_id: charge.id 
              })
              .eq("transaction_id", charge.payment_intent as string)
              .is("stripe_receipt_url", null);
            
            logStep("Updated receipts with Stripe receipt URL", { chargeId: charge.id });
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

    // Update webhook log
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
