import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
const RATE_LIMIT_PER_MINUTE = 60;
const DELAY_BETWEEN_EMAILS_MS = 100;

// Get SendPulse API access token
async function getSendPulseToken(): Promise<string> {
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
      client_secret: apiSecret
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("SendPulse auth error:", error);
    throw new Error("Failed to authenticate with SendPulse");
  }

  const data = await response.json();
  return data.access_token;
}

// Check warm-up limits before sending
async function checkWarmupLimit(supabase: any, emailCount: number): Promise<{ canSend: boolean; allowedCount: number; reason?: string }> {
  try {
    const { data: settings, error } = await supabase
      .from("email_warmup_settings")
      .select("*")
      .single();
    
    if (error || !settings) {
      return { canSend: true, allowedCount: emailCount };
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
      
      const remaining = newDailyLimit;
      return { 
        canSend: remaining > 0, 
        allowedCount: Math.min(emailCount, remaining),
        reason: remaining < emailCount ? `Warmup limit: only ${remaining} emails allowed today` : undefined
      };
    }

    if (!settings.is_warmup_active) {
      return { canSend: true, allowedCount: emailCount };
    }

    const remaining = settings.daily_limit - settings.emails_sent_today;
    if (remaining <= 0) {
      return { 
        canSend: false, 
        allowedCount: 0,
        reason: `Daily warmup limit reached (${settings.daily_limit} emails)` 
      };
    }

    return { 
      canSend: true, 
      allowedCount: Math.min(emailCount, remaining),
      reason: remaining < emailCount ? `Warmup limit: only ${remaining} emails allowed today` : undefined
    };
  } catch (error) {
    console.error("Error checking warmup limit:", error);
    return { canSend: true, allowedCount: emailCount };
  }
}

// Increment daily email counter
async function incrementEmailCounter(supabase: any, count: number): Promise<void> {
  try {
    const { data: settings } = await supabase
      .from("email_warmup_settings")
      .select("id, emails_sent_today")
      .single();
    
    if (settings) {
      await supabase
        .from("email_warmup_settings")
        .update({ emails_sent_today: settings.emails_sent_today + count })
        .eq("id", settings.id);
    }
  } catch (error) {
    console.error("Error incrementing email counter:", error);
  }
}

// Send a SINGLE email to ONE recipient (privacy-safe)
async function sendSingleEmail(
  token: string,
  recipient: Recipient,
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const htmlBase64 = btoa(unescape(encodeURIComponent(htmlContent)));
    // DELIVERABILITY FIX: Use friendly sender address
    const fromEmail = Deno.env.get("SENDPLUS_FROM_EMAIL") || "support@plagaiscans.com";

    const response = await fetch("https://api.sendpulse.com/smtp/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        email: {
          html: htmlBase64,
          text: htmlContent.replace(/<[^>]*>/g, ''),
          subject: subject,
          from: {
            // DELIVERABILITY FIX: Human-friendly sender name
            name: "Plagaiscans Team",
            email: fromEmail
          },
          to: [{ 
            email: recipient.email,
            name: recipient.email.split('@')[0]
          }],
          reply_to: "support@plagaiscans.com"
        }
      })
    });

    if (response.ok) {
      const result = await response.json();
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

    // Check warmup limit
    const warmupCheck = await checkWarmupLimit(supabase, recipients.length);
    if (!warmupCheck.canSend) {
      return new Response(
        JSON.stringify({ success: false, error: warmupCheck.reason }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Limit recipients if warmup is active
    const recipientsToSend = recipients.slice(0, warmupCheck.allowedCount);
    console.log(`Sending individual emails to ${recipientsToSend.length} recipients (warmup limit: ${warmupCheck.allowedCount})`);

    const siteUrl = "https://plagaiscans.com";

    // Get icon based on email type (removed from email for deliverability)
    const typeIcons: Record<string, string> = {
      announcement: '📢',
      payment_reminder: '💳',
      document_status: '📄',
      promotional: '🎉',
      welcome: '👋',
      custom: '📧'
    };

    const token = await getSendPulseToken();
    
    let successCount = 0;
    let failedCount = 0;

    // Send emails INDIVIDUALLY for privacy
    for (const recipient of recipientsToSend) {
      const unsubscribeToken = btoa(`${recipient.id}:${Date.now()}`);
      const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}&uid=${recipient.id}`;
      
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
              
              <h1 style="color: #18181b; margin: 0 0 20px 0; font-size: 24px;">${title}</h1>
              
              <div style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                ${message.replace(/\n/g, '<br>')}
              </div>
              
              ${ctaText && ctaUrl ? `
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${ctaUrl}" 
                   style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                  ${ctaText}
                </a>
              </div>
              ` : ''}
              
              <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0;">
                If you have any questions, feel free to reply to this email.
              </p>
              
              <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 30px 0;">
              
              <p style="color: #a1a1aa; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                Plagaiscans<br>
                <a href="${siteUrl}" style="color: #6366f1; text-decoration: none;">${siteUrl}</a>
                ${isPromotional ? `
                <br><br>
                <span style="color: #71717a;">Don't want to receive promotional emails?</span><br>
                <a href="${unsubscribeUrl}" style="color: #71717a; text-decoration: underline;">Unsubscribe</a>
                ` : ''}
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const result = await sendSingleEmail(token, recipient, subject, htmlContent);
      
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

      await sleep(DELAY_BETWEEN_EMAILS_MS);
    }

    // Increment warmup counter
    await incrementEmailCounter(supabase, successCount);

    console.log(`Email sending complete: ${successCount} success, ${failedCount} failed`);

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
        total: recipients.length,
        warmupLimited: warmupCheck.allowedCount < recipients.length,
        warmupMessage: warmupCheck.reason
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
