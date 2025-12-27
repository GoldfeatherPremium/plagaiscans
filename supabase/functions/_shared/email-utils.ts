// Shared email utilities for all edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Email configuration constants
export const EMAIL_CONFIG = {
  FROM_NAME: "Plagaiscans Support",
  FROM_EMAIL: "support@plagaiscans.com",
  REPLY_TO: "support@plagaiscans.com",
  SITE_URL: "https://plagaiscans.com",
};

// Rate limiting constants for email warm-up
export const WARMUP_CONFIG = {
  INITIAL_DAILY_LIMIT: 20,
  INCREMENT_PER_DAY: 10,
  MAX_DAILY_LIMIT: 500,
  DELAY_BETWEEN_EMAILS_MS: 1000, // 1 second between emails
  RETRY_DELAY_MS: 60000, // 60 seconds retry delay
  MAX_RETRIES: 2,
};

// Get SendPulse access token
export async function getSendPulseToken(): Promise<string> {
  const apiKey = Deno.env.get("SENDPLUS_API_KEY");
  const apiSecret = Deno.env.get("SENDPLUS_API_SECRET");

  if (!apiKey || !apiSecret) {
    throw new Error("SendPulse API credentials not configured");
  }

  const response = await fetch("https://api.sendpulse.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: apiKey,
      client_secret: apiSecret,
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
export async function sendEmailViaSendPulse(
  token: string,
  to: { email: string; name?: string },
  subject: string,
  htmlContent: string,
  options?: {
    replyTo?: string;
    disableTracking?: boolean;
  }
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

    const emailPayload: any = {
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
        // Reply-to for support inquiries
        reply_to: options?.replyTo || EMAIL_CONFIG.REPLY_TO,
      },
    };

    const response = await fetch("https://api.sendpulse.com/smtp/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(emailPayload),
    });

    const result = await response.json();
    console.log("SendPulse response:", result);

    if (!response.ok) {
      return { success: false, response: result, error: `HTTP ${response.status}` };
    }

    return { success: true, response: result };
  } catch (error: any) {
    console.error("SendPulse send error:", error);
    return { success: false, error: error?.message || "Unknown error" };
  }
}

// Send email with retry logic
export async function sendEmailWithRetry(
  token: string,
  to: { email: string; name?: string },
  subject: string,
  htmlContent: string,
  maxRetries: number = WARMUP_CONFIG.MAX_RETRIES
): Promise<{ success: boolean; response?: any; error?: string; attempts: number }> {
  let lastError: string | undefined;
  let lastResponse: any;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    console.log(`Email send attempt ${attempt}/${maxRetries + 1} to ${to.email.substring(0, 5)}...`);
    
    const result = await sendEmailViaSendPulse(token, to, subject, htmlContent);
    
    if (result.success) {
      return { success: true, response: result.response, attempts: attempt };
    }
    
    lastError = result.error;
    lastResponse = result.response;
    
    if (attempt <= maxRetries) {
      console.log(`Retry after ${WARMUP_CONFIG.RETRY_DELAY_MS}ms...`);
      await sleep(WARMUP_CONFIG.RETRY_DELAY_MS);
    }
  }
  
  return { success: false, error: lastError, response: lastResponse, attempts: maxRetries + 1 };
}

// Check and update email warm-up status
export async function checkEmailWarmup(supabase: any): Promise<{ canSend: boolean; dailyLimit: number; emailsSentToday: number }> {
  try {
    const { data: warmupSettings, error } = await supabase
      .from("email_warmup_settings")
      .select("*")
      .single();

    if (error || !warmupSettings) {
      console.log("No warmup settings found, allowing send");
      return { canSend: true, dailyLimit: WARMUP_CONFIG.MAX_DAILY_LIMIT, emailsSentToday: 0 };
    }

    // Check if we need to reset daily counter
    const today = new Date().toISOString().split('T')[0];
    if (warmupSettings.last_reset_date !== today) {
      // Reset counter for new day
      const newWarmupDay = warmupSettings.current_warmup_day + 1;
      const newDailyLimit = Math.min(
        WARMUP_CONFIG.INITIAL_DAILY_LIMIT + (newWarmupDay * WARMUP_CONFIG.INCREMENT_PER_DAY),
        WARMUP_CONFIG.MAX_DAILY_LIMIT
      );

      await supabase
        .from("email_warmup_settings")
        .update({
          last_reset_date: today,
          emails_sent_today: 0,
          current_warmup_day: newWarmupDay,
          daily_limit: newDailyLimit,
          updated_at: new Date().toISOString(),
        })
        .eq("id", warmupSettings.id);

      return { canSend: true, dailyLimit: newDailyLimit, emailsSentToday: 0 };
    }

    // Check if within daily limit
    if (warmupSettings.is_warmup_active && warmupSettings.emails_sent_today >= warmupSettings.daily_limit) {
      console.log(`Daily email limit reached: ${warmupSettings.emails_sent_today}/${warmupSettings.daily_limit}`);
      return { canSend: false, dailyLimit: warmupSettings.daily_limit, emailsSentToday: warmupSettings.emails_sent_today };
    }

    return { 
      canSend: true, 
      dailyLimit: warmupSettings.daily_limit, 
      emailsSentToday: warmupSettings.emails_sent_today 
    };
  } catch (error) {
    console.error("Error checking warmup:", error);
    return { canSend: true, dailyLimit: WARMUP_CONFIG.MAX_DAILY_LIMIT, emailsSentToday: 0 };
  }
}

// Increment email counter after successful send
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
  } catch (error) {
    console.error("Error incrementing email counter:", error);
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
  } catch (error) {
    console.error("Error updating email log:", error);
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
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${title}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5; -webkit-font-smoothing: antialiased;">
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
