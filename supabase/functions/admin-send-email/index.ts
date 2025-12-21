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

// Get SendPlus API access token
async function getSendPlusToken(): Promise<string> {
  const apiKey = Deno.env.get("SENDPLUS_API_KEY");
  const apiSecret = Deno.env.get("SENDPLUS_API_SECRET");

  if (!apiKey || !apiSecret) {
    throw new Error("SendPlus API credentials not configured");
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
    console.error("SendPlus auth error:", error);
    throw new Error("Failed to authenticate with SendPlus");
  }

  const data = await response.json();
  return data.access_token;
}

// Send email using SendPlus SMTP API
async function sendEmail(
  token: string,
  fromEmail: string,
  toEmails: string[],
  subject: string,
  htmlContent: string
): Promise<{ success: number; failed: number }> {
  let successCount = 0;
  let failedCount = 0;

  // SendPlus SMTP API - send in batches
  const batchSize = 50;
  
  for (let i = 0; i < toEmails.length; i += batchSize) {
    const batch = toEmails.slice(i, i + batchSize);
    
    try {
      const response = await fetch("https://api.sendpulse.com/smtp/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          email: {
            html: htmlContent,
            text: htmlContent.replace(/<[^>]*>/g, ''),
            subject: subject,
            from: {
              name: "PlagaiScans",
              email: fromEmail
            },
            to: batch.map(email => ({ email }))
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log("SendPlus batch response:", result);
        successCount += batch.length;
      } else {
        const error = await response.text();
        console.error("SendPlus send error:", error);
        failedCount += batch.length;
      }
    } catch (error) {
      console.error("Batch send error:", error);
      failedCount += batch.length;
    }
  }

  return { success: successCount, failed: failedCount };
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

    let emails: string[] = [];

    // Get recipient emails based on target audience
    if (targetAudience === 'specific' && specificUserIds?.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email")
        .in("id", specificUserIds);
      
      emails = profiles?.map(p => p.email) || [];
    } else if (targetAudience === 'customers') {
      const { data: customerRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "customer");
      
      if (customerRoles?.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email")
          .in("id", customerRoles.map(r => r.user_id));
        emails = profiles?.map(p => p.email) || [];
      }
    } else if (targetAudience === 'staff') {
      const { data: staffRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "staff");
      
      if (staffRoles?.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email")
          .in("id", staffRoles.map(r => r.user_id));
        emails = profiles?.map(p => p.email) || [];
      }
    } else if (targetAudience === 'admins') {
      const { data: adminRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      
      if (adminRoles?.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email")
          .in("id", adminRoles.map(r => r.user_id));
        emails = profiles?.map(p => p.email) || [];
      }
    } else {
      // All users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email");
      emails = profiles?.map(p => p.email) || [];
    }

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No recipients found" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending emails to ${emails.length} recipients via SendPlus`);

    const siteUrl = "https://plagaiscans.com";
    const fromEmail = Deno.env.get("SENDPLUS_FROM_EMAIL") || "noreply@plagaiscans.com";

    // Get icon based on email type
    const typeIcons: Record<string, string> = {
      announcement: '📢',
      payment_reminder: '💳',
      document_status: '📄',
      promotional: '🎉',
      welcome: '👋',
      custom: '📧'
    };
    
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
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); width: 60px; height: 60px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
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
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 30px 0;">
            
            <p style="color: #a1a1aa; text-align: center; margin: 0; font-size: 12px;">
              This email was sent from PlagaiScans.<br>
              <a href="${siteUrl}" style="color: #3b82f6; text-decoration: none;">Visit our website</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Get SendPlus token and send emails
    const token = await getSendPlusToken();
    const result = await sendEmail(token, fromEmail, emails, subject, htmlContent);

    console.log(`Email sending complete: ${result.success} success, ${result.failed} errors`);

    // Update email log if logId provided
    if (logId) {
      await supabase
        .from("email_logs")
        .update({
          status: result.failed > 0 ? 'partial' : 'sent',
          success_count: result.success,
          failed_count: result.failed,
          sent_at: new Date().toISOString()
        })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: result.success,
        failed: result.failed,
        total: emails.length 
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
