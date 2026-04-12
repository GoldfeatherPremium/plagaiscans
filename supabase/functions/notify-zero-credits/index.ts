import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmailViaSendPulse, EMAIL_CONFIG } from "../_shared/email-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, creditType } = await req.json();

    if (!userId || !creditType) {
      return new Response(JSON.stringify({ error: "userId and creditType required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name, credit_balance, similarity_credit_balance, email_unsubscribed")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Profile not found:", profileError?.message);
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Double-check balance is actually zero
    const balance = creditType === "similarity" || creditType === "similarity_only"
      ? profile.similarity_credit_balance
      : profile.credit_balance;

    if (balance > 0) {
      console.log("Credits not zero, skipping notification");
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userName = profile.full_name || "Customer";
    const isSimilarity = creditType === "similarity" || creditType === "similarity_only";
    const creditLabel = isSimilarity ? "Similarity" : "Full Scan";

    // 1. Send in-app notification
    await supabase.from("user_notifications").insert({
      user_id: userId,
      title: `${creditLabel} Credits Depleted`,
      message: `Your ${creditLabel.toLowerCase()} credits have reached zero. Purchase more credits to continue scanning documents.`,
    });

    console.log(`In-app notification sent to ${profile.email}`);

    // 2. Send push notification
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          title: `${creditLabel} Credits Depleted`,
          body: `Your ${creditLabel.toLowerCase()} credits have reached zero. Buy more to continue scanning!`,
          userId: userId,
          url: "/dashboard/buy-credits",
          eventType: "zero_credits",
        }),
      });
      console.log("Push notification sent");
    } catch (e) {
      console.error("Push notification error:", e);
    }

    // 3. Send email (if not unsubscribed)
    if (!profile.email_unsubscribed) {
      const subject = `Your ${creditLabel} Credits Have Run Out – Plagaiscans`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5;">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px;">
                      <div style="text-align: center; margin-bottom: 20px;">
                        <span style="background-color: #ef4444; color: white; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600;">CREDITS DEPLETED</span>
                      </div>
                      
                      <h1 style="color: #18181b; text-align: center; margin: 0 0 10px 0; font-size: 24px;">Your ${creditLabel} Credits Are Zero</h1>
                      
                      <p style="color: #71717a; text-align: center; margin: 0 0 30px 0;">Hello ${userName},</p>
                      
                      <div style="background-color: #fef2f2; border: 1px solid #ef4444; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
                        <p style="margin: 0 0 5px 0; color: #991b1b; font-size: 14px;">${creditLabel} Credit Balance</p>
                        <p style="margin: 0; color: #7f1d1d; font-size: 48px; font-weight: 700;">0</p>
                      </div>
                      
                      <p style="color: #71717a; text-align: center; margin: 0 0 20px 0;">You've used all your ${creditLabel.toLowerCase()} credits. Purchase more credits to continue checking your documents for plagiarism${isSimilarity ? '' : ' and AI content'}.</p>
                      
                      <div style="text-align: center; margin-bottom: 15px;">
                        <a href="${EMAIL_CONFIG.SITE_URL}/dashboard/buy-credits" 
                           style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                          Buy Credits Now
                        </a>
                      </div>
                      
                      <p style="color: #a1a1aa; text-align: center; margin: 0 0 0 0; font-size: 13px;">Get more credits and keep your documents safe ✨</p>
                      
                      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                        <p style="color: #9ca3af; text-align: center; margin: 0; font-size: 12px;">
                          <a href="${EMAIL_CONFIG.SITE_URL}" style="color: #6366f1; text-decoration: none;">plagaiscans.com</a>
                        </p>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const result = await sendEmailViaSendPulse(
        { email: profile.email, name: userName },
        subject,
        htmlContent
      );

      console.log(`Email ${result.success ? 'sent' : 'failed'} to ${profile.email}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
