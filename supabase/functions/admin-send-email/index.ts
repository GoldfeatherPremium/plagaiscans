import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Email configuration constants
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
  type: 'announcement' | 'payment_reminder' | 'document_status' | 'promotional' | 'welcome' | 'custom';
  targetAudience?: 'all' | 'customers' | 'staff' | 'specific' | 'admins';
  specificUserIds?: string[];
  subject: string;
  title: string;
  message: string;
  ctaText?: string;
  ctaUrl?: string;
  scheduledAt?: string;
  logId?: string;
}

interface Recipient {
  id: string;
  email: string;
}

// Rate limiting: max emails per minute
const DELAY_BETWEEN_EMAILS_MS = 500;

// Send a SINGLE email to ONE recipient using Resend
async function sendSingleEmail(
  apiKey: string,
  recipient: Recipient,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: `${EMAIL_CONFIG.FROM_NAME} <${EMAIL_CONFIG.FROM_EMAIL}>`,
        to: [recipient.email],
        subject: subject,
        html: htmlContent,
        reply_to: EMAIL_CONFIG.REPLY_TO
      })
    });

    if (response.ok) {
      console.log(`Email sent to recipient ${recipient.id.substring(0, 8)}...`);
      return { success: true };
    } else {
      const error = await response.text();
      console.error(`Failed to send to ${recipient.id.substring(0, 8)}...:`, error);
      return { success: false, error };
    }
  } catch (error: any) {
    console.error(`Error sending to ${recipient.id.substring(0, 8)}...:`, error.message);
    return { success: false, error: error.message };
  }
}

// Sleep helper for rate limiting
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      type, 
      targetAudience, 
      specificUserIds, 
      subject, 
      title, 
      message, 
      ctaText, 
      ctaUrl,
      logId 
    }: EmailRequest = await req.json();

    console.log("Admin email request:", { type, targetAudience, subject, logId });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const isPromotional = type === 'promotional' || type === 'announcement';
    
    let recipients: Recipient[] = [];

    // Get recipient emails based on target audience
    // CRITICAL: Exclude unsubscribed users for promotional emails
    if (targetAudience === 'specific' && specificUserIds?.length) {
      let query = supabase
        .from("profiles")
        .select("id, email")
        .in("id", specificUserIds);
      
      if (isPromotional) {
        query = query.or('email_unsubscribed.is.null,email_unsubscribed.eq.false');
      }
      
      const { data: profiles } = await query;
      recipients = profiles?.map(p => ({ id: p.id, email: p.email })) || [];
    } else if (targetAudience === 'customers') {
      const { data: customerRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "customer");
      
      if (customerRoles?.length) {
        let query = supabase
          .from("profiles")
          .select("id, email")
          .in("id", customerRoles.map(r => r.user_id));
        
        if (isPromotional) {
          query = query.or('email_unsubscribed.is.null,email_unsubscribed.eq.false');
        }
        
        const { data: profiles } = await query;
        recipients = profiles?.map(p => ({ id: p.id, email: p.email })) || [];
      }
    } else if (targetAudience === 'staff') {
      const { data: staffRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "staff");
      
      if (staffRoles?.length) {
        let query = supabase
          .from("profiles")
          .select("id, email")
          .in("id", staffRoles.map(r => r.user_id));
        
        if (isPromotional) {
          query = query.or('email_unsubscribed.is.null,email_unsubscribed.eq.false');
        }
        
        const { data: profiles } = await query;
        recipients = profiles?.map(p => ({ id: p.id, email: p.email })) || [];
      }
    } else if (targetAudience === 'admins') {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      
      if (adminRoles?.length) {
        let query = supabase
          .from("profiles")
          .select("id, email")
          .in("id", adminRoles.map(r => r.user_id));
        
        if (isPromotional) {
          query = query.or('email_unsubscribed.is.null,email_unsubscribed.eq.false');
        }
        
        const { data: profiles } = await query;
        recipients = profiles?.map(p => ({ id: p.id, email: p.email })) || [];
      }
    } else {
      // All users
      let query = supabase
        .from("profiles")
        .select("id, email");
      
      if (isPromotional) {
        query = query.or('email_unsubscribed.is.null,email_unsubscribed.eq.false');
      }
      
      const { data: profiles } = await query;
      recipients = profiles?.map(p => ({ id: p.id, email: p.email })) || [];
    }

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No recipients found" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Log recipient count only (never log actual emails)
    console.log(`Sending individual emails to ${recipients.length} recipients`);

    // Get icon based on email type
    const typeIcons: Record<string, string> = {
      announcement: '📢',
      payment_reminder: '💳',
      document_status: '📄',
      promotional: '🎉',
      welcome: '👋',
      custom: '📧'
    };

    // Get Resend API key
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    
    let successCount = 0;
    let failedCount = 0;

    // Send emails INDIVIDUALLY for privacy
    for (const recipient of recipients) {
      // Generate unique unsubscribe token for this recipient
      const unsubscribeToken = btoa(`${recipient.id}:${Date.now()}`);
      const unsubscribeUrl = `${EMAIL_CONFIG.SITE_URL}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}&uid=${recipient.id}`;
      
      // Build HTML content with unsubscribe link for promotional emails
      const htmlContent = `
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
                        <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); width: 60px; height: 60px; border-radius: 12px; display: inline-block; line-height: 60px;">
                          <span style="color: white; font-size: 28px;">${typeIcons[type] || '📧'}</span>
                        </div>
                      </div>
                      
                      <h1 style="color: #18181b; text-align: center; margin: 0 0 20px 0; font-size: 24px;">${title}</h1>
                      
                      <div style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                        ${message.replace(/\n/g, '<br>')}
                      </div>
                      
                      ${ctaText && ctaUrl ? `
                      <div style="text-align: center; margin-bottom: 30px;">
                        <a href="${ctaUrl}" 
                           style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                          ${ctaText}
                        </a>
                      </div>
                      ` : ''}
                      
                      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                        <p style="color: #6b7280; text-align: center; margin: 0 0 10px 0; font-size: 13px;">
                          Regards,<br>
                          <strong>Plagaiscans Support Team</strong>
                        </p>
                        <p style="color: #9ca3af; text-align: center; margin: 0; font-size: 12px;">
                          <a href="${EMAIL_CONFIG.SITE_URL}" style="color: #3b82f6; text-decoration: none;">plagaiscans.com</a>
                          ${isPromotional ? `
                          <br><br>
                          <span style="color: #71717a;">Don't want to receive promotional emails?</span><br>
                          <a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline; font-size: 11px;">Unsubscribe</a>
                          ` : ''}
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

      const result = await sendSingleEmail(apiKey, recipient, subject, htmlContent);
      
      // Log individual send result (privacy-safe - no email addresses)
      if (logId) {
        await supabase
          .from("email_send_logs")
          .insert({
            email_log_id: logId,
            recipient_id: recipient.id,
            status: result.success ? 'sent' : 'failed',
            error_message: result.error || null
          });
      }

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }

      // Rate limiting: delay between emails for better deliverability
      await sleep(DELAY_BETWEEN_EMAILS_MS);
    }

    console.log(`Email sending complete: ${successCount} success, ${failedCount} failed`);

    // Update email log if logId provided
    if (logId) {
      await supabase
        .from("email_logs")
        .update({
          status: failedCount > 0 ? (successCount > 0 ? 'partial' : 'failed') : 'sent',
          success_count: successCount,
          failed_count: failedCount,
          sent_at: new Date().toISOString()
        })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount,
        failed: failedCount,
        total: recipients.length 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in admin-send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
