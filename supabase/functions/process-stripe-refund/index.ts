import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-STRIPE-REFUND] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    // Authenticate admin user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    const adminUser = userData.user;
    if (!adminUser) throw new Error("User not authenticated");

    // Check if user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", adminUser.id)
      .single();

    if (roleData?.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    logStep("Admin authenticated", { adminId: adminUser.id });

    const { paymentIntentId, amount, reason } = await req.json();
    logStep("Request body", { paymentIntentId, amount, reason });

    if (!paymentIntentId) throw new Error("Payment Intent ID is required");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get payment info from our database
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("stripe_payments")
      .select("*")
      .eq("payment_intent_id", paymentIntentId)
      .single();

    if (paymentError || !payment) {
      throw new Error("Payment not found in database");
    }

    logStep("Payment found", { userId: payment.user_id, credits: payment.credits, amountUsd: payment.amount_usd });

    // Create refund in Stripe
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
      reason: reason as Stripe.RefundCreateParams.Reason || "requested_by_customer",
    };

    // If partial refund amount specified
    if (amount && amount > 0 && amount < payment.amount_usd * 100) {
      refundParams.amount = amount;
    }

    const refund = await stripe.refunds.create(refundParams);
    logStep("Stripe refund created", { refundId: refund.id, amount: refund.amount });

    // Calculate credits to deduct
    const refundRatio = refund.amount / (payment.amount_usd * 100);
    const creditsToDeduct = Math.ceil(payment.credits * refundRatio);

    // Get user's current balance
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credit_balance")
      .eq("id", payment.user_id)
      .single();

    const currentBalance = profile?.credit_balance || 0;
    const newBalance = Math.max(0, currentBalance - creditsToDeduct);

    // Deduct credits from user
    await supabaseAdmin
      .from("profiles")
      .update({ credit_balance: newBalance })
      .eq("id", payment.user_id);

    // Log the transaction
    await supabaseAdmin.from("credit_transactions").insert({
      user_id: payment.user_id,
      amount: -creditsToDeduct,
      balance_before: currentBalance,
      balance_after: newBalance,
      transaction_type: "refund",
      description: `Admin refund - ${creditsToDeduct} credits deducted - Refund: ${refund.id.slice(-8)}`,
      performed_by: adminUser.id,
    });

    // Record refund in our database
    await supabaseAdmin.from("stripe_refunds").insert({
      user_id: payment.user_id,
      payment_intent_id: paymentIntentId,
      refund_id: refund.id,
      amount_cents: refund.amount,
      credits_deducted: creditsToDeduct,
      reason: reason || "requested_by_customer",
      status: "completed",
      processed_at: new Date().toISOString(),
      processed_by: adminUser.id,
    });

    // Update payment status
    const isFullRefund = refund.amount >= payment.amount_usd * 100;
    await supabaseAdmin
      .from("stripe_payments")
      .update({ status: isFullRefund ? "refunded" : "partially_refunded" })
      .eq("payment_intent_id", paymentIntentId);

    // Notify user
    await supabaseAdmin.from("user_notifications").insert({
      user_id: payment.user_id,
      title: "Refund Processed 💸",
      message: `A refund of $${(refund.amount / 100).toFixed(2)} has been processed. ${creditsToDeduct} credits have been deducted from your account.`,
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
          userId: payment.user_id,
          title: 'Refund Processed 💸',
          body: `$${(refund.amount / 100).toFixed(2)} refunded, ${creditsToDeduct} credits deducted.`,
          data: { type: 'refund', url: '/dashboard/payments' },
        }),
      });
    } catch (pushError) {
      logStep("Failed to send push notification", { error: pushError });
    }

    logStep("Refund processed successfully", { 
      refundId: refund.id, 
      creditsDeducted: creditsToDeduct,
      newBalance 
    });

    return new Response(JSON.stringify({
      success: true,
      refund: {
        id: refund.id,
        amount: refund.amount,
        credits_deducted: creditsToDeduct,
        status: refund.status,
      },
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
