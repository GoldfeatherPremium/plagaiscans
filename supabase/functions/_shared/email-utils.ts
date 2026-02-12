// Shared email utilities for all edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Email configuration constants
export const EMAIL_CONFIG = {
  FROM_NAME: "Plagaiscans Support",
  FROM_EMAIL: "support@plagaiscans.com",
  REPLY_TO: "support@plagaiscans.com",
  SITE_URL: "https://plagaiscans.com",
};

// Send email via Sender.net API
export async function sendEmailViaSenderNet(
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
    return { success: false, error: error?.message || "Unknown error" };
  }
}

// Check if email setting is enabled
export async function isEmailEnabled(supabase: any, settingKey: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("email_settings")
      .select("is_enabled")
      .eq("setting_key", settingKey)
      .maybeSingle();
    if (error || !data) return true;
    return data.is_enabled;
  } catch (error) {
    return true;
  }
}

// Log email to transactional_email_logs
export async function logEmail(
  supabase: any,
  params: {
    emailType: string;
    recipientId?: string;
    recipientEmail: string;
    recipientName?: string;
    subject: string;
    documentId?: string;
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
        document_id: params.documentId || null,
        status: params.status,
        provider_response: params.providerResponse || null,
        error_message: params.errorMessage || null,
        metadata: params.metadata || null,
        sent_at: params.status === "sent" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();
    if (error) return null;
    return data?.id || null;
  } catch (error) {
    return null;
  }
}

// Update existing email log
export async function updateEmailLog(
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
        sent_at: params.status === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", logId);
  } catch (error) {}
}

// Increment email counter
export async function incrementEmailCounter(supabase: any): Promise<void> {
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
  } catch (error) {}
}

// Sleep helper for rate limiting
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Generate clean email footer
export function getEmailFooter(includeUnsubscribe: boolean = false, unsubscribeUrl?: string): string {
  return `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      <p style="color: #6b7280; text-align: center; margin: 0 0 10px 0; font-size: 13px;">
        Regards,<br>
        <strong>Plagaiscans Support Team</strong>
      </p>
      <p style="color: #9ca3af; text-align: center; margin: 0; font-size: 12px;">
        <a href="${EMAIL_CONFIG.SITE_URL}" style="color: #6366f1; text-decoration: none;">plagaiscans.com</a>
        ${includeUnsubscribe && unsubscribeUrl ? `
          <br><br>
          <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline; font-size: 11px;">Unsubscribe from promotional emails</a>
        ` : ''}
      </p>
    </div>
  `;
}

// Get base email template wrapper
export function wrapEmailContent(content: string, iconEmoji: string, title: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
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
                      <span style="color: white; font-size: 28px;">${iconEmoji}</span>
                    </div>
                  </div>
                  ${content}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}