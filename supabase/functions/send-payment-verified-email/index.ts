import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAIL_CONFIG = {
  FROM_NAME: "Plagaiscans Support",
  FROM_EMAIL: "support@plagaiscans.com",
  REPLY_TO: "support@plagaiscans.com",
  SITE_URL: "https://plagaiscans.com",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  userId: string;
  credits: number;
  amountUsd: number;
  paymentMethod: string;
  retryLogId?: string;
}

// Send email via Sender.net API
async function sendEmail(
  apiKey: string,
  to: { email: string; name?: string },
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; response?: any; error?: string }> {
  try {
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
    if (!response.ok) {
      console.error("Sender.net error:", result);
      return { success: false, response: result, error: `HTTP ${response.status}` };
    }
    return { success: true, response: result };
  } catch (error: any) {
    console.error("Sender.net send error:", error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

async function isEmailEnabled(supabase: any, settingKey: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("email_settings").select("is_enabled").eq("setting_key", settingKey).maybeSingle();
    if (error || !data) return true;
    return data.is_enabled;
  } catch (error) { return true; }
}

async function logEmail(supabase: any, params: any): Promise<string | null> {
  try {
    const { data, error } = await supabase.from("transactional_email_logs").insert({
      email_type: params.emailType, recipient_id: params.recipientId || null,
      recipient_email: params.recipientEmail, recipient_name: params.recipientName || null,
      subject: params.subject, status: params.status,
      provider_response: params.providerResponse || null, error_message: params.errorMessage || null,
      metadata: params.metadata || null, sent_at: params.status === 'sent' ? new Date().toISOString() : null,
    }).select('id').single();
    if (error) return null;
    return data?.id || null;
  } catch (error) { return null; }
}

async function updateEmailLog(supabase: any, logId: string, params: any): Promise<void> {
  try {
    await supabase.from("transactional_email_logs").update({
      status: params.status, provider_response: params.providerResponse || null,
      error_message: params.errorMessage || null,
      sent_at: params.status === 'sent' ? new Date().toISOString() : null,
    }).eq('id', logId);
  } catch (error) {}
}

async function incrementWarmupCounter(supabase: any): Promise<void> {
  try {
    const { data: warmupSettings } = await supabase.from("email_warmup_settings").select("id, emails_sent_today").single();
    if (warmupSettings) {
      await supabase.from("email_warmup_settings").update({
        emails_sent_today: warmupSettings.emails_sent_today + 1, updated_at: new Date().toISOString(),
      }).eq("id", warmupSettings.id);
    }
  } catch (error) {}
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, credits, amountUsd, paymentMethod, retryLogId }: EmailRequest = await req.json();

    console.log("Sending payment verified email for user:", userId, "retryLogId:", retryLogId);

    const apiKey = Deno.env.get("SENDER_NET_API_KEY");
    if (!apiKey) throw new Error("SENDER_NET_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const isEnabled = await isEmailEnabled(supabase, "payment_verified");
    if (!isEnabled) {
      console.log("Payment verified emails are disabled by admin, skipping");
      if (!retryLogId) {
        const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("id", userId).single();
        if (profile) {
          await logEmail(supabase, {
            emailType: "payment_verified", recipientId: userId, recipientEmail: profile.email,
            recipientName: profile.full_name, subject: "Payment Verified - Credits Added - Plagaiscans",
            status: "skipped", metadata: { credits, amountUsd, paymentMethod, reason: "Email disabled by admin" },
          });
        }
      }
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Email disabled by admin" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("email, full_name, credit_balance").eq("id", userId).single();

    if (profileError || !profile) throw new Error("User profile not found");

    const userName = profile.full_name || "Customer";
    const methodDisplay = paymentMethod === 'binance_pay' ? 'Binance Pay' : paymentMethod;
    const subject = "Payment Verified - Credits Added - Plagaiscans";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Verified</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="padding: 40px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); width: 60px; height: 60px; border-radius: 12px; display: inline-block; line-height: 60px;">
                        <span style="color: white; font-size: 28px;">✓</span>
                      </div>
                    </div>
                    
                    <h1 style="color: #18181b; text-align: center; margin: 0 0 10px 0; font-size: 24px;">Payment Verified</h1>
                    
                    <p style="color: #71717a; text-align: center; margin: 0 0 30px 0;">Hello ${userName}, your payment has been verified and credits have been added to your account.</p>
                    
                    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
                      <p style="margin: 0 0 5px 0; color: #166534; font-size: 14px;">Credits Added</p>
                      <p style="margin: 0; color: #166534; font-size: 36px; font-weight: bold;">+${credits}</p>
                    </div>
                    
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                      <tr>
                        <td style="width: 48%; background-color: #f4f4f5; border-radius: 8px; padding: 15px; text-align: center;">
                          <p style="margin: 0 0 5px 0; color: #71717a; font-size: 12px;">Amount Paid</p>
                          <p style="margin: 0; color: #18181b; font-size: 18px; font-weight: 600;">$${amountUsd}</p>
                        </td>
                        <td style="width: 4%;"></td>
                        <td style="width: 48%; background-color: #f4f4f5; border-radius: 8px; padding: 15px; text-align: center;">
                          <p style="margin: 0 0 5px 0; color: #71717a; font-size: 12px;">Payment Method</p>
                          <p style="margin: 0; color: #18181b; font-size: 18px; font-weight: 600;">${methodDisplay}</p>
                        </td>
                      </tr>
                    </table>
                    
                    <div style="background-color: #fef3c7; border-radius: 8px; padding: 15px; margin-bottom: 20px; text-align: center;">
                      <p style="margin: 0 0 5px 0; color: #92400e; font-size: 12px;">New Balance</p>
                      <p style="margin: 0; color: #92400e; font-size: 24px; font-weight: bold;">${profile.credit_balance} Credits</p>
                    </div>
                    
                    <div style="text-align: center;">
                      <a href="${EMAIL_CONFIG.SITE_URL}/dashboard/upload" 
                         style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                        Upload Document Now
                      </a>
                    </div>
                    
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                      <p style="color: #6b7280; text-align: center; margin: 0 0 10px 0; font-size: 13px;">
                        Regards,<br>
                        <strong>Plagaiscans Support Team</strong>
                      </p>
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

    if (retryLogId) {
      await updateEmailLog(supabase, retryLogId, {
        status: result.success ? 'sent' : 'failed',
        providerResponse: result.response, errorMessage: result.error,
      });
    } else {
      await logEmail(supabase, {
        emailType: "payment_verified", recipientId: userId, recipientEmail: profile.email,
        recipientName: userName, subject,
        status: result.success ? 'sent' : 'failed',
        providerResponse: result.response, errorMessage: result.error,
        metadata: { credits, amountUsd, paymentMethod },
      });
    }

    if (result.success) {
      await incrementWarmupCounter(supabase);
      console.log("Payment verified email sent successfully");
    } else {
      throw new Error(result.error || "Failed to send email");
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-payment-verified-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);