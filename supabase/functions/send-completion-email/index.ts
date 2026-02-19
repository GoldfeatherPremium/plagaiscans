import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmailViaSendPulse, isEmailEnabled, logEmail as sharedLogEmail, updateEmailLog, incrementEmailCounter, EMAIL_CONFIG } from "../_shared/email-utils.ts";

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

// Retryable HTTP status codes
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

// Send email with auto-retry via SendPulse
async function sendEmailWithRetry(
  to: { email: string; name?: string },
  subject: string,
  htmlContent: string,
  maxRetries: number = 3
): Promise<{ success: boolean; response?: any; error?: string; retryCount?: number }> {
  let lastError = '';
  let lastResponse: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const result = await sendEmailViaSendPulse(to, subject, htmlContent);

    if (result.success) {
      if (attempt > 0) {
        console.log(`Email sent successfully on retry attempt ${attempt}`);
      }
      return { success: true, response: result.response, retryCount: attempt };
    }

    lastError = result.error || 'Unknown error';
    lastResponse = result.response;

    // Check if error is retryable
    const statusMatch = lastError.match(/HTTP (\d+)/);
    if (statusMatch && !RETRYABLE_STATUS_CODES.includes(parseInt(statusMatch[1]))) {
      return { success: false, response: lastResponse, error: lastError, retryCount: attempt };
    }
  }

  console.error(`All ${maxRetries + 1} attempts failed for email to ${to.email}`);
  return { success: false, response: lastResponse, error: `Failed after ${maxRetries + 1} attempts. Last error: ${lastError}`, retryCount: maxRetries };
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

  try {
    const { documentId, userId, fileName, similarityPercentage = 0, aiPercentage = 0, retryLogId }: EmailRequest = await req.json();

    console.log("Sending completion email for document:", documentId, "userId:", userId, "fileName:", fileName, "retryLogId:", retryLogId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const isEnabled = await isEmailEnabled(supabase, "document_completion");
    if (!isEnabled) {
      console.log("Document completion emails are disabled by admin, skipping");
      
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
                    
                    <div style="text-align: center;">
                      <a href="${EMAIL_CONFIG.SITE_URL}/dashboard/documents" 
                         style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                        View Full Report
                      </a>
                    </div>
                    
                    <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-top: 20px; border-left: 4px solid #f59e0b;">
                      <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
                        <strong>⚠️ Important:</strong> Please download your reports within <strong>7 days</strong>. 
                        After this period, the files will be automatically removed from our servers for security and privacy purposes.
                      </p>
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

    const result = await sendEmailWithRetry(
      { email: profile.email, name: userName },
      subject,
      htmlContent
    );

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

    if (result.success) {
      await incrementWarmupCounter(supabase);
    }

    // Send push notification
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
      console.error("Email delivery failed after retries:", result.error);
      return new Response(
        JSON.stringify({ success: false, error: result.error || "Failed to send email", retryCount: result.retryCount }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Completion email sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-completion-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
