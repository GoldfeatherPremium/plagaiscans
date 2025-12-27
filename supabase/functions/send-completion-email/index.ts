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

interface EmailRequest {
  documentId: string;
  userId: string;
  fileName: string;
  similarityPercentage?: number;
  aiPercentage?: number;
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
): Promise<{ success: boolean; response?: any; error?: string }> {
  try {
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

// Log email to database
async function logEmail(
  supabase: any,
  data: {
    email_type: string;
    recipient_id?: string;
    recipient_email: string;
    recipient_name?: string;
    subject: string;
    document_id?: string;
    status: string;
    provider_response?: any;
    error_message?: string;
    metadata?: any;
  }
): Promise<void> {
  try {
    await supabase.from("transactional_email_logs").insert({
      email_type: data.email_type,
      recipient_id: data.recipient_id,
      recipient_email: data.recipient_email,
      recipient_name: data.recipient_name,
      subject: data.subject,
      document_id: data.document_id,
      status: data.status,
      provider_response: data.provider_response,
      error_message: data.error_message,
      sent_at: data.status === 'sent' ? new Date().toISOString() : null,
      metadata: data.metadata,
    });
    console.log("Email logged to database:", data.status);
  } catch (error) {
    console.error("Failed to log email:", error);
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, userId, fileName, similarityPercentage = 0, aiPercentage = 0 }: EmailRequest = await req.json();

    console.log("Sending completion email for document:", documentId, "userId:", userId, "fileName:", fileName);

    if (!SENDPULSE_API_KEY || !SENDPULSE_API_SECRET) {
      console.error("SendPulse credentials not configured");
      throw new Error("Email service is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check warmup limit
    const warmupCheck = await checkWarmupLimit(supabase);
    if (!warmupCheck.canSend) {
      console.log("Warmup limit reached, skipping email");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: warmupCheck.reason }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if document completion emails are enabled
    const isEnabled = await isEmailEnabled(supabase, "document_completion");
    if (!isEnabled) {
      console.log("Document completion emails are disabled by admin, skipping");
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", userId)
        .single();
      
      if (profile) {
        await logEmail(supabase, {
          email_type: 'document_completion',
          recipient_id: userId,
          recipient_email: profile.email,
          recipient_name: profile.full_name,
          subject: 'Your Document Has Been Processed - Plagaiscans',
          document_id: documentId,
          status: 'skipped',
          metadata: { fileName, reason: 'Email disabled by admin' },
        });
      }
      
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Email disabled by admin" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name, email_unsubscribed")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      throw new Error("User profile not found");
    }

    if (profile.email_unsubscribed) {
      console.log("User has unsubscribed from emails, skipping");
      await logEmail(supabase, {
        email_type: 'document_completion',
        recipient_id: userId,
        recipient_email: profile.email,
        recipient_name: profile.full_name,
        subject: 'Your Document Has Been Processed - Plagaiscans',
        document_id: documentId,
        status: 'skipped',
        metadata: { fileName, reason: 'User unsubscribed' },
      });
      
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "User unsubscribed" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userName = profile.full_name || "there";
    const siteUrl = Deno.env.get("SITE_URL") || "https://plagaiscans.com";
    // DELIVERABILITY FIX: Clean subject without emojis
    const subject = "Your Document Has Been Processed - Plagaiscans";

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
              Great news! Your document has been successfully processed and is ready for review.
            </p>
            
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <p style="margin: 0 0 10px 0; color: #71717a; font-size: 14px;">Document</p>
              <p style="margin: 0; color: #18181b; font-weight: 600;">${fileName}</p>
            </div>
            
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
              <tr>
                <td style="width: 48%; background-color: #fef3c7; border-radius: 8px; padding: 20px; text-align: center;">
                  <p style="margin: 0 0 5px 0; color: #92400e; font-size: 14px;">Similarity</p>
                  <p style="margin: 0; color: #92400e; font-size: 28px; font-weight: bold;">${similarityPercentage}%</p>
                </td>
                <td style="width: 4%;"></td>
                <td style="width: 48%; background-color: #dbeafe; border-radius: 8px; padding: 20px; text-align: center;">
                  <p style="margin: 0 0 5px 0; color: #1e40af; font-size: 14px;">AI Detection</p>
                  <p style="margin: 0; color: #1e40af; font-size: 28px; font-weight: bold;">${aiPercentage}%</p>
                </td>
              </tr>
            </table>
            
            <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              You can view the full report by clicking the button below.
            </p>
            
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${siteUrl}/dashboard/documents" 
                 style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                View Full Report
              </a>
            </div>
            
            <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 10px 0;">
              If you have any questions about your report, feel free to reply to this email.
            </p>
            
            <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0;">
              Best regards,<br>
              The Plagaiscans Team
            </p>
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 30px 0;">
            
            <p style="color: #a1a1aa; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
              Plagaiscans<br>
              <a href="${siteUrl}" style="color: #6366f1; text-decoration: none;">${siteUrl}</a><br><br>
              You're receiving this email because you used our document analysis service.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmailViaSendPulse(
      token,
      { email: profile.email, name: userName },
      subject,
      htmlContent
    );

    // Increment warmup counter
    if (result.success) {
      await incrementEmailCounter(supabase);
    }

    await logEmail(supabase, {
      email_type: 'document_completion',
      recipient_id: userId,
      recipient_email: profile.email,
      recipient_name: userName,
      subject: subject,
      document_id: documentId,
      status: result.success ? 'sent' : 'failed',
      provider_response: result.response,
      error_message: result.error,
      metadata: { fileName, similarityPercentage, aiPercentage },
    });

    if (!result.success) {
      throw new Error(result.error || "Failed to send email");
    }

    console.log("Completion email sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-completion-email function:", error);
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
