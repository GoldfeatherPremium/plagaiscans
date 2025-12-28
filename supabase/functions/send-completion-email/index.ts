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
  documentId: string;
  userId: string;
  fileName: string;
  similarityPercentage?: number;
  aiPercentage?: number;
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

// Send email via SendPulse SMTP API with improved deliverability
async function sendEmailViaSendPulse(
  token: string,
  to: { email: string; name?: string },
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; response?: any; error?: string }> {
  try {
    // Encode HTML content to Base64
    const htmlBase64 = btoa(unescape(encodeURIComponent(htmlContent)));
    
    // Create plain text version for better deliverability
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
): Promise<string | null> {
  try {
    const { data: result, error } = await supabase.from("transactional_email_logs").insert({
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
    }).select('id').single();
    
    if (error) {
      console.error("Failed to log email:", error);
      return null;
    }
    console.log("Email logged to database:", data.status);
    return result?.id || null;
  } catch (error) {
    console.error("Failed to log email:", error);
    return null;
  }
}

// Update existing email log
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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, userId, fileName, similarityPercentage = 0, aiPercentage = 0, retryLogId }: EmailRequest = await req.json();

    console.log("Sending completion email for document:", documentId, "userId:", userId, "fileName:", fileName, "retryLogId:", retryLogId);

    // Check if SendPulse credentials are configured
    if (!SENDPULSE_API_KEY || !SENDPULSE_API_SECRET) {
      console.error("SendPulse credentials not configured");
      throw new Error("Email service is not configured");
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if document completion emails are enabled
    const isEnabled = await isEmailEnabled(supabase, "document_completion");
    if (!isEnabled) {
      console.log("Document completion emails are disabled by admin, skipping");
      
      // Log skipped email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", userId)
        .single();
      
      if (profile && !retryLogId) {
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

    // Get user email from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name, email_unsubscribed")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      throw new Error("User profile not found");
    }

    // Check if user has unsubscribed from emails
    if (profile.email_unsubscribed) {
      console.log("User has unsubscribed from emails, skipping");
      if (!retryLogId) {
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
      }
      
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "User unsubscribed" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userName = profile.full_name || "Customer";
    const subject = "Your Document Has Been Processed - Plagaiscans";

    // Get SendPulse token
    const token = await getSendPulseToken();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document Processed</title>
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
                        <span style="color: white; font-size: 28px;">✓</span>
                      </div>
                    </div>
                    
                    <h1 style="color: #18181b; text-align: center; margin: 0 0 10px 0; font-size: 24px;">Document Processing Complete</h1>
                    
                    <p style="color: #71717a; text-align: center; margin: 0 0 30px 0;">Hello ${userName}, your document has been analyzed and is ready for review.</p>
                    
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
                    
                    <div style="text-align: center;">
                      <a href="${EMAIL_CONFIG.SITE_URL}/dashboard/documents" 
                         style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                        View Full Report
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
      { email: profile.email, name: userName },
      subject,
      htmlContent
    );

    // Log or update email result
    if (retryLogId) {
      await updateEmailLog(supabase, retryLogId, {
        status: result.success ? 'sent' : 'failed',
        providerResponse: result.response,
        errorMessage: result.error,
      });
    } else {
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
    }

    // Increment warmup counter on success
    if (result.success) {
      await incrementWarmupCounter(supabase);
    }

    // Send push notification to the user (background delivery)
    try {
      const pushRes = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          title: 'Document Ready 📄',
          body: `Your document "${fileName}" has been processed.`,
          userId,
          url: '/dashboard/documents',
          eventType: 'document_completion',
        }),
      });
      const pushData = await pushRes.json();
      console.log('Push notification result:', pushData);
    } catch (pushErr) {
      console.error('Failed to send push notification:', pushErr);
    }

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
