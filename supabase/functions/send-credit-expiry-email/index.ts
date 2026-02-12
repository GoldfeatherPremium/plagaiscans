import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAIL_CONFIG = {
  FROM_NAME: "Plagaiscans",
  FROM_EMAIL: "support@plagaiscans.com",
  REPLY_TO: "support@plagaiscans.com",
  SITE_URL: "https://plagaiscans.com",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(apiKey: string, to: { email: string; name?: string }, subject: string, htmlContent: string) {
  const response = await fetch("https://api.sender.net/v2/message/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      to: { email: to.email, name: to.name || to.email.split('@')[0] },
      from: { email: EMAIL_CONFIG.FROM_EMAIL, name: EMAIL_CONFIG.FROM_NAME },
      subject,
      html: htmlContent,
      reply_to: { email: EMAIL_CONFIG.REPLY_TO, name: EMAIL_CONFIG.FROM_NAME },
    }),
  });

  const result = await response.json();
  return { success: response.ok, response: result };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in1Day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    console.log("Checking for expiring credits...");

    const { data: credits7Days } = await supabase
      .from("credit_validity")
      .select("id, user_id, remaining_credits, expires_at")
      .eq("expired", false)
      .gt("remaining_credits", 0)
      .gte("expires_at", in7Days.toISOString().split('T')[0])
      .lt("expires_at", new Date(in7Days.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    const { data: credits1Day } = await supabase
      .from("credit_validity")
      .select("id, user_id, remaining_credits, expires_at")
      .eq("expired", false)
      .gt("remaining_credits", 0)
      .gte("expires_at", in1Day.toISOString().split('T')[0])
      .lt("expires_at", tomorrow.toISOString().split('T')[0]);

    const allCredits = [
      ...(credits7Days || []).map(c => ({ ...c, daysLeft: 7 })),
      ...(credits1Day || []).map(c => ({ ...c, daysLeft: 1 })),
    ];

    if (allCredits.length === 0) {
      console.log("No expiring credits found");
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${allCredits.length} expiring credit records`);

    const apiKey = Deno.env.get("SENDER_NET_API_KEY");
    if (!apiKey) throw new Error("SENDER_NET_API_KEY not configured");
    let sentCount = 0;

    for (const credit of allCredits) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name, email_unsubscribed")
        .eq("id", credit.user_id)
        .single();

      if (!profile || profile.email_unsubscribed) continue;

      const userName = profile.full_name || "Customer";
      const expiryDate = new Date(credit.expires_at).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });

      const subject = credit.daysLeft === 1
        ? `⚠️ Your credits expire tomorrow - Plagaiscans`
        : `Reminder: Your credits expire in ${credit.daysLeft} days - Plagaiscans`;

      const urgencyColor = credit.daysLeft === 1 ? '#ef4444' : '#f59e0b';
      const urgencyText = credit.daysLeft === 1 ? 'EXPIRES TOMORROW' : `EXPIRES IN ${credit.daysLeft} DAYS`;

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
                        <span style="background-color: ${urgencyColor}; color: white; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600;">${urgencyText}</span>
                      </div>
                      
                      <h1 style="color: #18181b; text-align: center; margin: 0 0 10px 0; font-size: 24px;">Your Credits Are Expiring Soon</h1>
                      
                      <p style="color: #71717a; text-align: center; margin: 0 0 30px 0;">Hello ${userName}, don't lose your credits!</p>
                      
                      <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
                        <p style="margin: 0 0 5px 0; color: #92400e; font-size: 14px;">Remaining Credits</p>
                        <p style="margin: 0; color: #78350f; font-size: 32px; font-weight: 700;">${credit.remaining_credits}</p>
                        <p style="margin: 10px 0 0 0; color: #92400e; font-size: 14px;">Expires: ${expiryDate}</p>
                      </div>
                      
                      <p style="color: #71717a; text-align: center; margin: 0 0 20px 0;">Use your credits before they expire to check your documents for plagiarism and AI content.</p>
                      
                      <div style="text-align: center;">
                        <a href="${EMAIL_CONFIG.SITE_URL}/dashboard/upload" 
                           style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                          Upload Document Now
                        </a>
                      </div>
                      
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

      const result = await sendEmail(apiKey, { email: profile.email, name: userName }, subject, htmlContent);
      
      if (result.success) {
        sentCount++;
        console.log(`Sent expiry reminder to ${profile.email} (${credit.daysLeft} days left)`);

        try {
          await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              title: credit.daysLeft === 1 ? '⚠️ Credits Expire Tomorrow!' : `Credits Expire in ${credit.daysLeft} Days`,
              body: `You have ${credit.remaining_credits} credits expiring on ${expiryDate}. Use them now!`,
              userId: credit.user_id,
              url: '/dashboard/upload',
              eventType: 'credit_expiry_reminder',
            }),
          });
        } catch (e) {
          console.error('Push notification error:', e);
        }
      }
    }

    console.log(`Sent ${sentCount} expiry reminder emails`);

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
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