import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[EXPIRE-CREDITS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Find all expired credit validity records that haven't been processed
    const { data: expiredCredits, error: fetchError } = await supabaseClient
      .from("credit_validity")
      .select("*")
      .eq("expired", false)
      .lt("expires_at", new Date().toISOString());

    if (fetchError) {
      throw new Error(`Failed to fetch expired credits: ${fetchError.message}`);
    }

    logStep("Found expired credits", { count: expiredCredits?.length || 0 });

    if (!expiredCredits || expiredCredits.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No expired credits to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    let processedCount = 0;
    const errors: string[] = [];

    for (const creditRecord of expiredCredits) {
      try {
        const remainingCredits = creditRecord.remaining_credits;
        
        if (remainingCredits > 0) {
          // Get user's current balance
          const { data: profile, error: profileError } = await supabaseClient
            .from("profiles")
            .select("credit_balance")
            .eq("id", creditRecord.user_id)
            .single();

          if (profileError) {
            throw new Error(`Failed to fetch profile: ${profileError.message}`);
          }

          const currentBalance = profile?.credit_balance || 0;
          // Only deduct up to the remaining credits or current balance
          const creditsToDeduct = Math.min(remainingCredits, currentBalance);
          const newBalance = currentBalance - creditsToDeduct;

          logStep("Expiring credits for user", {
            userId: creditRecord.user_id,
            remainingCredits,
            currentBalance,
            creditsToDeduct,
            newBalance,
          });

          if (creditsToDeduct > 0) {
            // Update user balance
            const { error: updateError } = await supabaseClient
              .from("profiles")
              .update({ credit_balance: newBalance })
              .eq("id", creditRecord.user_id);

            if (updateError) {
              throw new Error(`Failed to update profile: ${updateError.message}`);
            }

            // Create transaction record
            const { error: transactionError } = await supabaseClient
              .from("credit_transactions")
              .insert({
                user_id: creditRecord.user_id,
                amount: -creditsToDeduct,
                balance_before: currentBalance,
                balance_after: newBalance,
                transaction_type: "expiration",
                description: `Time-limited credits expired (${creditsToDeduct} credits)`,
              });

            if (transactionError) {
              logStep("Failed to create transaction", { error: transactionError.message });
            }

            // Send notification to user
            await supabaseClient.from("user_notifications").insert({
              user_id: creditRecord.user_id,
              title: "Credits Expired",
              message: `${creditsToDeduct} time-limited credits have expired and been removed from your balance.`,
            });
          }
        }

        // Mark as expired - save remaining_credits before zeroing
        const { error: markError } = await supabaseClient
          .from("credit_validity")
          .update({ expired: true, remaining_credits: 0, credits_expired_unused: remainingCredits })
          .eq("id", creditRecord.id);

        if (markError) {
          throw new Error(`Failed to mark as expired: ${markError.message}`);
        }

        processedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Credit ${creditRecord.id}: ${errorMessage}`);
        logStep("Error processing credit", { id: creditRecord.id, error: errorMessage });
      }
    }

    logStep("Completed", { processedCount, errorCount: errors.length });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} expired credit records`,
        processed: processedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
