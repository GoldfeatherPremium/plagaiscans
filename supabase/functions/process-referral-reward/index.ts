import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[REFERRAL-REWARD] ${step}${detailsStr}`);
};

const MAX_LIFETIME_REWARDS = 20;
const MIN_PAYMENT_USD = 3;
const REWARD_DELAY_HOURS = 48;

async function logFraudCheck(
  referralId: string | null,
  referrerId: string,
  referredUserId: string | null,
  checkType: string,
  checkResult: string,
  details: any
) {
  try {
    await supabaseAdmin.from("referral_fraud_logs").insert({
      referral_id: referralId,
      referrer_id: referrerId,
      referred_user_id: referredUserId,
      check_type: checkType,
      check_result: checkResult,
      details,
    });
  } catch (e) {
    console.error("Failed to log fraud check:", e);
  }
}

async function awardReferralCredit(userId: string, description: string, creditType: string = "full") {
  const balanceField = creditType === "similarity_only" ? "similarity_credit_balance" : "credit_balance";
  
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select(`${balanceField}`)
    .eq("id", userId)
    .single();

  if (!profile) {
    logStep("Profile not found for reward", { userId });
    return false;
  }

  const currentBalance = (profile as any)[balanceField] || 0;
  const newBalance = currentBalance + 1;

  await supabaseAdmin
    .from("profiles")
    .update({ [balanceField]: newBalance })
    .eq("id", userId);

  await supabaseAdmin.from("credit_transactions").insert({
    user_id: userId,
    amount: 1,
    balance_before: currentBalance,
    balance_after: newBalance,
    transaction_type: "add",
    credit_type: creditType === "similarity_only" ? "similarity" : "full",
    description,
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 3);

  await supabaseAdmin.from("credit_validity").insert({
    user_id: userId,
    credits_amount: 1,
    remaining_credits: 1,
    expires_at: expiresAt.toISOString(),
    credit_type: creditType === "similarity_only" ? "similarity" : "full",
  });

  logStep("Credit awarded", { userId, newBalance, expiresIn: "3 days" });
  return true;
}

// Calculate activity score for a user
async function calculateActivityScore(userId: string): Promise<number> {
  let score = 0;

  // Check document uploads
  const { count: docCount } = await supabaseAdmin
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((docCount || 0) > 0) score += 30;

  // Check account age (minutes since creation)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("created_at")
    .eq("id", userId)
    .single();

  if (profile) {
    const ageMinutes = (Date.now() - new Date(profile.created_at).getTime()) / 60000;
    if (ageMinutes > 30) score += 20; // At least 30 min on platform
    if (ageMinutes > 1440) score += 20; // At least 1 day old
  }

  // Check credit transactions (real purchases)
  const { count: txCount } = await supabaseAdmin
    .from("credit_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("transaction_type", "add");
  if ((txCount || 0) > 0) score += 30;

  return Math.min(score, 100);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, paymentAmountUsd } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Processing referral reward", { userId, paymentAmountUsd });

    // Check if user was referred
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("referred_by, email, shadow_banned")
      .eq("id", userId)
      .single();

    if (!profile?.referred_by) {
      logStep("User has no referrer, skipping");
      return new Response(JSON.stringify({ success: true, message: "No referrer" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SHADOW BAN CHECK: Silently skip if user is shadow banned
    if (profile.shadow_banned) {
      logStep("User is shadow banned, silently skipping reward");
      return new Response(JSON.stringify({ success: true, message: "Processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check referrer shadow ban too
    const { data: referrerProfile } = await supabaseAdmin
      .from("profiles")
      .select("shadow_banned")
      .eq("id", profile.referred_by)
      .single();

    if (referrerProfile?.shadow_banned) {
      logStep("Referrer is shadow banned, silently skipping reward");
      return new Response(JSON.stringify({ success: true, message: "Processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the referral record that's still pending
    const { data: referral } = await supabaseAdmin
      .from("referrals")
      .select("*")
      .eq("referred_user_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    if (!referral) {
      logStep("No pending referral found or already completed");
      return new Response(JSON.stringify({ success: true, message: "No pending referral" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // FRAUD FLAG CHECK
    if ((referral as any).fraud_flagged) {
      logStep("Referral is fraud-flagged, rejecting reward", { reason: (referral as any).fraud_reason });
      await supabaseAdmin
        .from("referrals")
        .update({ reward_status: "rejected" } as any)
        .eq("id", referral.id);
      await logFraudCheck(referral.id, referral.referrer_id, userId, "fraud_flagged", "REJECT", {
        reason: (referral as any).fraud_reason,
      });
      return new Response(JSON.stringify({ success: false, message: "Referral flagged as fraudulent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // MINIMUM PAYMENT CHECK ($3+)
    const actualPayment = paymentAmountUsd || 0;
    if (actualPayment < MIN_PAYMENT_USD) {
      logStep("Payment below minimum threshold", { amount: actualPayment, minimum: MIN_PAYMENT_USD });
      await logFraudCheck(referral.id, referral.referrer_id, userId, "min_payment", "REJECT", {
        amount: actualPayment,
        minimum: MIN_PAYMENT_USD,
      });
      return new Response(
        JSON.stringify({ success: false, message: "Payment below minimum threshold" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTIVITY SCORE CHECK
    const activityScore = await calculateActivityScore(userId);
    logStep("Activity score calculated", { userId, activityScore });

    // Update referral with payment and activity info
    await supabaseAdmin
      .from("referrals")
      .update({
        payment_amount_usd: actualPayment,
        activity_score: activityScore,
      } as any)
      .eq("id", referral.id);

    // If activity score too low, reject
    if (activityScore < 20) {
      logStep("Activity score too low, rejecting", { activityScore });
      await supabaseAdmin
        .from("referrals")
        .update({ reward_status: "rejected" } as any)
        .eq("id", referral.id);
      await logFraudCheck(referral.id, referral.referrer_id, userId, "low_activity", "REJECT", {
        activityScore,
      });
      return new Response(
        JSON.stringify({ success: false, message: "Insufficient platform activity" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // LIFETIME LIMIT CHECK
    const { count: completedCount } = await supabaseAdmin
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", referral.referrer_id)
      .eq("status", "completed");

    if ((completedCount || 0) >= MAX_LIFETIME_REWARDS) {
      logStep("Referrer exceeded lifetime reward limit", { completedCount });
      await supabaseAdmin
        .from("referrals")
        .update({
          status: "completed",
          credits_earned: 0,
          reward_given_to_referred: true,
          reward_status: "approved",
        } as any)
        .eq("id", referral.id);

      // Still award to referred user
      await awardReferralCredit(userId, "Referral bonus - first purchase reward");
      await supabaseAdmin.from("user_notifications").insert({
        user_id: userId,
        title: "Welcome Bonus! 🎁",
        message: "You earned 1 bonus credit for your first purchase via referral! (valid for 3 days)",
      });

      return new Response(
        JSON.stringify({ success: true, referrerAwarded: false, referredAwarded: true, reason: "Referrer limit reached" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. TIME DELAY SYSTEM: Set reward to DELAYED for 48 hours
    const delayUntil = new Date();
    delayUntil.setHours(delayUntil.getHours() + REWARD_DELAY_HOURS);

    await supabaseAdmin
      .from("referrals")
      .update({
        reward_status: "delayed",
        reward_delay_until: delayUntil.toISOString(),
      } as any)
      .eq("id", referral.id);

    await logFraudCheck(referral.id, referral.referrer_id, userId, "reward_delayed", "DELAY", {
      delayUntil: delayUntil.toISOString(),
      activityScore,
      paymentAmount: actualPayment,
    });

    logStep("Reward delayed for fraud review period", { delayUntil: delayUntil.toISOString() });

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: "delayed", 
        message: "Reward is under review and will be processed within 48 hours",
        delayUntil: delayUntil.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("Error", { error: message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
