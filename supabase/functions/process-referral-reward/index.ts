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

  // Update balance
  await supabaseAdmin
    .from("profiles")
    .update({ [balanceField]: newBalance })
    .eq("id", userId);

  // Log transaction
  await supabaseAdmin.from("credit_transactions").insert({
    user_id: userId,
    amount: 1,
    balance_before: currentBalance,
    balance_after: newBalance,
    transaction_type: "add",
    credit_type: creditType === "similarity_only" ? "similarity" : "full",
    description,
  });

  // Create credit_validity with 3-day expiry
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Processing referral reward", { userId });

    // Check if user was referred
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("referred_by, email")
      .eq("id", userId)
      .single();

    if (!profile?.referred_by) {
      logStep("User has no referrer, skipping");
      return new Response(JSON.stringify({ success: true, message: "No referrer" }), {
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

    const referrerId = referral.referrer_id;

    // Award 1 credit to referrer
    const referrerAwarded = await awardReferralCredit(
      referrerId,
      `Referral bonus - referred user ${profile.email} made first purchase`
    );

    // Award 1 credit to referred user
    const referredAwarded = await awardReferralCredit(
      userId,
      "Referral bonus - first purchase reward"
    );

    // Update referral record
    await supabaseAdmin
      .from("referrals")
      .update({
        status: "completed",
        credits_earned: 1,
        reward_given_to_referred: referredAwarded,
      })
      .eq("id", referral.id);

    // Send notifications
    if (referrerAwarded) {
      await supabaseAdmin.from("user_notifications").insert({
        user_id: referrerId,
        title: "Referral Reward! 🎉",
        message: `Your referral ${profile.email} made their first purchase! You earned 1 bonus credit (valid for 3 days).`,
      });
    }

    if (referredAwarded) {
      await supabaseAdmin.from("user_notifications").insert({
        user_id: userId,
        title: "Welcome Bonus! 🎁",
        message: "You earned 1 bonus credit for your first purchase via referral! (valid for 3 days)",
      });
    }

    logStep("Referral reward processed", { referrerId, referredUserId: userId });

    return new Response(
      JSON.stringify({ success: true, referrerAwarded, referredAwarded }),
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
