import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Email configuration constants
const EMAIL_CONFIG = {
  FROM_NAME: "Plagaiscans Support",
  FROM_EMAIL: "support@plagaiscans.com",
  REPLY_TO: "support@plagaiscans.com",
  SITE_URL: "https://plagaiscans.com",
};

const SENDPULSE_API_KEY = Deno.env.get("SENDPLUS_API_KEY");
const SENDPULSE_API_SECRET = Deno.env.get("SENDPLUS_API_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  userId: string;
  email: string;
  fullName?: string;
  retryLogId?: string;
}

// Get SendPulse access token
async function getSendPulseToken(): Promise<string> {
  const response = await fetch("https://api.sendpulse.com/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: SENDPULSE_API_KEY,
      client_secret: SENDPULSE_API_SECRET,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("SendPulse auth error:", errorText);
    throw new Error("Failed to authenticate with SendPulse");
  }

  const data = await response.json();
  return data.access_token;
}

// Send email via SendPulse SMTP API
async function sendEmailViaSendPulse(
  token: string,
  to: { email: string; name?: string },
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; response?: any; error?: string }> {
  try {
    const htmlBase64 = btoa(unescape(encodeURIComponent(htmlContent)));
    
    const textContent = htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const response = await fetch("https://api.sendpulse.com/smtp/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: {
          html: htmlBase64,
          text: textContent,
          subject: subject,
          from: {
            name: EMAIL_CONFIG.FROM_NAME,
            email: EMAIL_CONFIG.FROM_EMAIL,
          },
          to: [
            {
              email: to.email,
              name: to.name || to.email.split('@')[0],
            },
          ],
          reply_to: EMAIL_CONFIG.REPLY_TO,
        },
      }),
    });

    const result = await response.json();
    console.log("SendPulse response:", result);

    if (!response.ok) {
      return { success: false, response: result, error: `HTTP ${response.status}` };
    }

    return { success: true, response: result };
  } catch (error: any) {
    console.error("SendPulse send error:", error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

// Check if email setting is enabled
async function isEmailEnabled(supabase: any, settingKey: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("email_settings")
      .select("is_enabled")
      .eq("setting_key", settingKey)
      .maybeSingle();
    
    if (error || !data) {
      console.log(`Email setting ${settingKey} not found, defaulting to enabled`);
      return true;
    }
    
    return data.is_enabled;
  } catch (error) {
    console.error("Error checking email setting:", error);
    return true;
  }
}

// Log email to transactional_email_logs
async function logEmail(
  supabase: any,
  params: {
    emailType: string;
    recipientId?: string;
    recipientEmail: string;
    recipientName?: string;
    subject: string;
    status: string;
    providerResponse?: any;
    errorMessage?: string;
    metadata?: any;
  }
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("transactional_email_logs")
      .insert({
        email_type: params.emailType,
        recipient_id: params.recipientId || null,
        recipient_email: params.recipientEmail,
        recipient_name: params.recipientName || null,
        subject: params.subject,
        status: params.status,
        provider_response: params.providerResponse || null,
        error_message: params.errorMessage || null,
        metadata: params.metadata || null,
        sent_at: params.status === 'sent' ? new Date().toISOString() : null,
      })
      .select('id')
      .single();
    
    if (error) {
      console.error("Error logging email:", error);
      return null;
    }
    return data?.id || null;
  } catch (error) {
    console.error("Error logging email:", error);
    return null;
  }
}

// Update existing email log (for retries)
async function updateEmailLog(
  supabase: any,
  logId: string,
  params: {
    status: string;
    providerResponse?: any;
    errorMessage?: string;
  }
): Promise<void> {
  try {
    await supabase
      .from("transactional_email_logs")
      .update({
        status: params.status,
        provider_response: params.providerResponse || null,
        error_message: params.errorMessage || null,
        sent_at: params.status === 'sent' ? new Date().toISOString() : null,
      })
      .eq('id', logId);
  } catch (error) {
    console.error("Error updating email log:", error);
  }
}

// Increment warmup counter
async function incrementWarmupCounter(supabase: any): Promise<void> {
  try {
    const { data: warmupSettings } = await supabase
      .from("email_warmup_settings")
      .select("id, emails_sent_today")
      .single();

    if (warmupSettings) {
      await supabase
        .from("email_warmup_settings")
        .update({
          emails_sent_today: warmupSettings.emails_sent_today + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", warmupSettings.id);
    }
  } catch (error) {
    console.error("Error incrementing warmup counter:", error);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { userId, email, fullName, retryLogId }: EmailRequest = await req.json();

    console.log("Sending welcome email to:", email, "userId:", userId, "retryLogId:", retryLogId);

    if (!SENDPULSE_API_KEY || !SENDPULSE_API_SECRET) {
      console.error("SendPulse credentials not configured");
      throw new Error("Email service is not configured");
    }

    // Check if welcome emails are enabled
    const isEnabled = await isEmailEnabled(supabase, "welcome_email");
    if (!isEnabled) {
      console.log("Welcome emails are disabled by admin, skipping");
      
      if (!retryLogId) {
        await logEmail(supabase, {
          emailType: "welcome",
          recipientId: userId,
          recipientEmail: email,
          recipientName: fullName,
          subject: "Welcome to Plagaiscans",
          status: "skipped",
          metadata: { reason: "Email disabled by admin" },
        });
      }
      
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Email disabled by admin" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userName = fullName || "Customer";
    const subject = "Welcome to Plagaiscans";

    const token = await getSendPulseToken();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Plagaiscans</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="padding: 40px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); width: 60px; height: 60px; border-radius: 12px; display: inline-block; line-height: 60px;">
                        <span style="color: white; font-size: 28px;">👋</span>
                      </div>
                    </div>
                    
                    <h1 style="color: #18181b; text-align: center; margin: 0 0 10px 0; font-size: 24px;">Welcome to Plagaiscans</h1>
                    
                    <p style="color: #71717a; text-align: center; margin: 0 0 30px 0;">Hello ${userName}, thank you for joining us!</p>
                    
                    <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                      <h3 style="color: #18181b; margin: 0 0 15px 0;">What you can do:</h3>
                      <ul style="color: #71717a; margin: 0; padding-left: 20px;">
                        <li style="margin-bottom: 10px;">Upload documents for plagiarism and AI detection</li>
                        <li style="margin-bottom: 10px;">Get detailed similarity and AI reports</li>
                        <li style="margin-bottom: 10px;">Download professional reports</li>
                        <li style="margin-bottom: 0;">Track all your documents in one place</li>
                      </ul>
                    </div>
                    
                    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
                      <p style="margin: 0; color: #166534; font-weight: 600;">We ensure all files are processed securely in non-repository instructor accounts. Your data will not be saved.</p>
                    </div>
                    
                    <div style="text-align: center;">
                      <a href="${EMAIL_CONFIG.SITE_URL}/dashboard" 
                         style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                        Go to Dashboard
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

    const result = await sendEmailViaSendPulse(
      token,
      { email, name: userName },
      subject,
      htmlContent
    );

    // Log success or update existing log
    if (retryLogId) {
      await updateEmailLog(supabase, retryLogId, {
        status: result.success ? "sent" : "failed",
        providerResponse: result.response,
        errorMessage: result.error,
      });
    } else {
      await logEmail(supabase, {
        emailType: "welcome",
        recipientId: userId,
        recipientEmail: email,
        recipientName: fullName,
        subject,
        status: result.success ? "sent" : "failed",
        providerResponse: result.response,
        errorMessage: result.error,
      });
    }

    if (result.success) {
      await incrementWarmupCounter(supabase);
      console.log("Welcome email sent successfully to:", email);
    } else {
      throw new Error(result.error || "Failed to send email");
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
