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
  console.log(`[PROCESS-DELAYED-REFERRALS] ${step}${detailsStr}`);
};

async function awardReferralCredit(userId: string, description: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("credit_balance")
    .eq("id", userId)
    .single();

  if (!profile) return false;

  const currentBalance = profile.credit_balance || 0;
  const newBalance = currentBalance + 1;

  await supabaseAdmin
    .from("profiles")
    .update({ credit_balance: newBalance })
    .eq("id", userId);

  await supabaseAdmin.from("credit_transactions").insert({
    user_id: userId,
    amount: 1,
    balance_before: currentBalance,
    balance_after: newBalance,
    transaction_type: "add",
    credit_type: "full",
    description,
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 3);

  await supabaseAdmin.from("credit_validity").insert({
    user_id: userId,
    credits_amount: 1,
    remaining_credits: 1,
    expires_at: expiresAt.toISOString(),
    credit_type: "full",
  });

  return true;
}

async function reCheckFraud(referral: any): Promise<{ pass: boolean; reason?: string }> {
  const referredUserId = referral.referred_user_id;
  const referrerId = referral.referrer_id;

  // Re-check shadow ban
  const { data: referrerProfile } = await supabaseAdmin
    .from("profiles")
    .select("shadow_banned, signup_ip")
    .eq("id", referrerId)
    .single();

  if (referrerProfile?.shadow_banned) {
    return { pass: false, reason: "Referrer shadow banned" };
  }

  const { data: referredProfile } = await supabaseAdmin
    .from("profiles")
    .select("shadow_banned, signup_ip, email")
    .eq("id", referredUserId)
    .single();

  if (referredProfile?.shadow_banned) {
    return { pass: false, reason: "Referred user shadow banned" };
  }

  // Re-check if payment was refunded
  // Check credit_transactions for any refund after the referral was created
  const { data: refundTx } = await supabaseAdmin
    .from("credit_transactions")
    .select("id")
    .eq("user_id", referredUserId)
    .eq("transaction_type", "refund")
    .gte("created_at", referral.created_at)
    .maybeSingle();

  if (refundTx) {
    return { pass: false, reason: "Payment was refunded" };
  }

  // Re-check activity score
  let activityScore = 0;
  const { count: docCount } = await supabaseAdmin
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", referredUserId);
  if ((docCount || 0) > 0) activityScore += 30;

  const { count: txCount } = await supabaseAdmin
    .from("credit_transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", referredUserId)
    .eq("transaction_type", "add");
  if ((txCount || 0) > 0) activityScore += 30;

  const ageMinutes = (Date.now() - new Date(referral.created_at).getTime()) / 60000;
  if (ageMinutes > 30) activityScore += 20;
  if (ageMinutes > 1440) activityScore += 20;

  if (activityScore < 20) {
    return { pass: false, reason: `Low activity score: ${activityScore}` };
  }

  // Check IP match between referrer and referred
  if (referrerProfile?.signup_ip && referredProfile?.signup_ip && 
      referrerProfile.signup_ip === referredProfile.signup_ip) {
    return { pass: false, reason: "IP match between referrer and referred user" };
  }

  return { pass: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Processing delayed referrals");

    // Find all referrals with reward_status = 'delayed' whose delay has expired
    const now = new Date().toISOString();
    const { data: delayedReferrals, error } = await supabaseAdmin
      .from("referrals")
      .select("*")
      .eq("reward_status", "delayed")
      .lte("reward_delay_until", now);

    if (error) throw error;

    if (!delayedReferrals || delayedReferrals.length === 0) {
      logStep("No delayed referrals to process");
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep(`Found ${delayedReferrals.length} delayed referrals to process`);

    let approved = 0;
    let rejected = 0;

    for (const referral of delayedReferrals) {
      try {
        const fraudResult = await reCheckFraud(referral);

        if (fraudResult.pass) {
          // APPROVE: Award credits to both
          const { data: referredProfile } = await supabaseAdmin
            .from("profiles")
            .select("email")
            .eq("id", referral.referred_user_id)
            .single();

          const referrerAwarded = await awardReferralCredit(
            referral.referrer_id,
            `Referral bonus - referred user ${referredProfile?.email || 'unknown'} made first purchase`
          );

          const referredAwarded = await awardReferralCredit(
            referral.referred_user_id,
            "Referral bonus - first purchase reward"
          );

          await supabaseAdmin
            .from("referrals")
            .update({
              status: "completed",
              credits_earned: referrerAwarded ? 1 : 0,
              reward_given_to_referred: referredAwarded,
              reward_status: "approved",
            } as any)
            .eq("id", referral.id);

          // Send notifications
          if (referrerAwarded) {
            await supabaseAdmin.from("user_notifications").insert({
              user_id: referral.referrer_id,
              title: "Referral Reward! 🎉",
              message: `Your referral made their first purchase! You earned 1 bonus credit (valid for 3 days).`,
            });
          }
          if (referredAwarded) {
            await supabaseAdmin.from("user_notifications").insert({
              user_id: referral.referred_user_id,
              title: "Welcome Bonus! 🎁",
              message: "You earned 1 bonus credit for your first purchase via referral! (valid for 3 days)",
            });
          }

          await supabaseAdmin.from("referral_fraud_logs").insert({
            referral_id: referral.id,
            referrer_id: referral.referrer_id,
            referred_user_id: referral.referred_user_id,
            check_type: "delayed_approval",
            check_result: "APPROVE",
            details: { referrerAwarded, referredAwarded },
          });

          approved++;
          logStep("Approved delayed referral", { id: referral.id });
        } else {
          // REJECT
          await supabaseAdmin
            .from("referrals")
            .update({
              reward_status: "rejected",
              fraud_flagged: true,
              fraud_reason: fraudResult.reason,
            } as any)
            .eq("id", referral.id);

          await supabaseAdmin.from("referral_fraud_logs").insert({
            referral_id: referral.id,
            referrer_id: referral.referrer_id,
            referred_user_id: referral.referred_user_id,
            check_type: "delayed_rejection",
            check_result: "REJECT",
            details: { reason: fraudResult.reason },
          });

          rejected++;
          logStep("Rejected delayed referral", { id: referral.id, reason: fraudResult.reason });
        }
      } catch (err) {
        logStep("Error processing individual referral", { id: referral.id, error: String(err) });
      }
    }

    logStep("Delayed referral processing complete", { approved, rejected });

    return new Response(
      JSON.stringify({ success: true, processed: delayedReferrals.length, approved, rejected }),
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
