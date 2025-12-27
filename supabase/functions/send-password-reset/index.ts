import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SENDPULSE_API_KEY = Deno.env.get("SENDPLUS_API_KEY");
const SENDPULSE_API_SECRET = Deno.env.get("SENDPLUS_API_SECRET");
// DELIVERABILITY FIX: Use friendly sender address instead of noreply
const SENDPULSE_FROM_EMAIL = Deno.env.get("SENDPLUS_FROM_EMAIL") || "support@plagaiscans.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
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

// Check warm-up limits before sending
async function checkWarmupLimit(supabase: any): Promise<{ canSend: boolean; reason?: string }> {
  try {
    const { data: settings, error } = await supabase
      .from("email_warmup_settings")
      .select("*")
      .single();
    
    if (error || !settings) {
      return { canSend: true };
    }

    const today = new Date().toISOString().split('T')[0];
    if (settings.last_reset_date !== today) {
      const daysSinceStart = Math.floor(
        (new Date().getTime() - new Date(settings.warmup_start_date).getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      
      const warmupLimits = [5, 10, 25, 50, 100];
      const newDailyLimit = daysSinceStart >= 5 ? 100 : warmupLimits[daysSinceStart - 1] || 100;
      
      await supabase
        .from("email_warmup_settings")
        .update({
          emails_sent_today: 0,
          last_reset_date: today,
          current_warmup_day: daysSinceStart,
          daily_limit: newDailyLimit,
          is_warmup_active: daysSinceStart < 5
        })
        .eq("id", settings.id);
      
      return { canSend: true };
    }

    if (settings.is_warmup_active && settings.emails_sent_today >= settings.daily_limit) {
      return { 
        canSend: false, 
        reason: `Daily warmup limit reached (${settings.daily_limit} emails)` 
      };
    }

    return { canSend: true };
  } catch (error) {
    console.error("Error checking warmup limit:", error);
    return { canSend: true };
  }
}

// Increment daily email counter
async function incrementEmailCounter(supabase: any): Promise<void> {
  try {
    const { data: settings } = await supabase
      .from("email_warmup_settings")
      .select("id, emails_sent_today")
      .single();
    
    if (settings) {
      await supabase
        .from("email_warmup_settings")
        .update({ emails_sent_today: settings.emails_sent_today + 1 })
        .eq("id", settings.id);
    }
  } catch (error) {
    console.error("Error incrementing email counter:", error);
  }
}

// Send email via SendPulse SMTP API
async function sendEmailViaSendPulse(
  token: string,
  to: { email: string; name?: string },
  subject: string,
  htmlContent: string
): Promise<any> {
  const htmlBase64 = btoa(unescape(encodeURIComponent(htmlContent)));

  const response = await fetch("https://api.sendpulse.com/smtp/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      email: {
        html: htmlBase64,
        subject: subject,
        from: {
          // DELIVERABILITY FIX: Human-friendly sender name
          name: "Plagaiscans Team",
          email: SENDPULSE_FROM_EMAIL,
        },
        to: [
          {
            email: to.email,
            name: to.name || to.email,
          },
        ],
      },
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error("SendPulse send error:", result);
    throw new Error(`Failed to send email: ${JSON.stringify(result)}`);
  }

  console.log("SendPulse response:", result);
  return result;
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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { email, retryLogId }: PasswordResetRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    console.log("Processing password reset request for:", email, "retryLogId:", retryLogId);

    if (!SENDPULSE_API_KEY || !SENDPULSE_API_SECRET) {
      console.error("SendPulse credentials not configured");
      throw new Error("Email service is not configured");
    }

    // Check warmup limit
    const warmupCheck = await checkWarmupLimit(supabase);
    if (!warmupCheck.canSend) {
      console.log("Warmup limit reached, skipping email");
      return new Response(
        JSON.stringify({ success: false, error: warmupCheck.reason }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if password reset emails are enabled
    const isEnabled = await isEmailEnabled(supabase, "password_reset");
    if (!isEnabled) {
      console.log("Password reset emails are disabled by admin");
      
      if (!retryLogId) {
        await logEmail(supabase, {
          emailType: "password_reset",
          recipientEmail: email,
          subject: "Reset Your Password - Plagaiscans",
          status: "skipped",
          metadata: { reason: "Email disabled by admin" },
        });
      }
      
      return new Response(
        JSON.stringify({ success: false, error: "Password reset is currently disabled. Please contact support." }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("Error checking profile:", profileError);
    }

    if (!profile) {
      console.log("User not found, returning success anyway for security");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const siteUrl = Deno.env.get("SITE_URL") || "https://plagaiscans.com";

    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: `${siteUrl}/reset-password`,
      },
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError);
      throw new Error("Failed to generate reset link");
    }

    const resetLink = resetData.properties.action_link;
    const userName = profile.full_name || "there";
    // DELIVERABILITY FIX: Clean subject without emojis
    const subject = "Reset Your Password - Plagaiscans";

    console.log("Sending password reset email to:", email);

    const token = await getSendPulseToken();
    
    // DELIVERABILITY FIX: Clean, human-friendly email template
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <h1 style="color: #18181b; margin: 0 0 20px 0; font-size: 24px;">Hi ${userName},</h1>
            
            <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              We received a request to reset your password for your Plagaiscans account.
            </p>
            
            <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
              Click the button below to set a new password. This link will expire in 24 hours.
            </p>
            
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${resetLink}" 
                 style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                Reset Password
              </a>
            </div>
            
            <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </div>
            
            <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
              If you have any questions, feel free to reply to this email.
            </p>
            
            <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0;">
              Best regards,<br>
              The Plagaiscans Team
            </p>
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 30px 0;">
            
            <p style="color: #a1a1aa; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
              Plagaiscans<br>
              <a href="${siteUrl}" style="color: #6366f1; text-decoration: none;">${siteUrl}</a><br><br>
              You're receiving this email because a password reset was requested for your account.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      const providerResponse = await sendEmailViaSendPulse(
        token,
        { email: email, name: userName },
        subject,
        htmlContent
      );

      console.log("Password reset email sent successfully");

      // Increment warmup counter
      await incrementEmailCounter(supabase);

      if (retryLogId) {
        await updateEmailLog(supabase, retryLogId, {
          status: "sent",
          providerResponse,
        });
      } else {
        await logEmail(supabase, {
          emailType: "password_reset",
          recipientId: profile.id,
          recipientEmail: email,
          recipientName: userName,
          subject,
          status: "sent",
          providerResponse,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (sendError: any) {
      console.error("Failed to send password reset email:", sendError);

      if (retryLogId) {
        await updateEmailLog(supabase, retryLogId, {
          status: "failed",
          errorMessage: sendError.message,
        });
      } else {
        await logEmail(supabase, {
          emailType: "password_reset",
          recipientId: profile.id,
          recipientEmail: email,
          recipientName: userName,
          subject,
          status: "failed",
          errorMessage: sendError.message,
        });
      }

      throw sendError;
    }
  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
