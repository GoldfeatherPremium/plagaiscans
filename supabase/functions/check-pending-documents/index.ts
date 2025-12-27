import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SENDPULSE_API_KEY = Deno.env.get("SENDPLUS_API_KEY");
const SENDPULSE_API_SECRET = Deno.env.get("SENDPLUS_API_SECRET");
const SENDPULSE_FROM_EMAIL = Deno.env.get("SENDPLUS_FROM_EMAIL") || "support@plagaiscans.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get SendPulse access token
async function getSendPulseToken(): Promise<string> {
  const response = await fetch("https://api.sendpulse.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

// Send email via SendPulse
async function sendEmailViaSendPulse(
  token: string,
  to: { email: string; name?: string },
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; error?: string }> {
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
            name: "Plagaiscans Team",
            email: SENDPULSE_FROM_EMAIL,
          },
          to: [{ email: to.email, name: to.name || to.email }],
        },
      }),
    });

    const result = await response.json();
    console.log("SendPulse response:", result);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error: any) {
    console.error("SendPulse send error:", error);
    return { success: false, error: error?.message || "Unknown error" };
  }
}

// Check warmup limit before sending
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
      return { canSend: false, reason: `Daily warmup limit reached (${settings.daily_limit} emails)` };
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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Checking for pending documents older than 15 minutes...");

    if (!SENDPULSE_API_KEY || !SENDPULSE_API_SECRET) {
      console.error("SendPulse credentials not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate 15 minutes ago
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // Find pending documents that:
    // 1. Have status 'pending'
    // 2. Are not assigned to any staff
    // 3. Were uploaded more than 15 minutes ago
    // 4. Haven't had a reminder sent yet
    const { data: pendingDocs, error: docsError } = await supabase
      .from("documents")
      .select("id, file_name, uploaded_at, user_id")
      .eq("status", "pending")
      .is("assigned_staff_id", null)
      .is("pending_reminder_sent_at", null)
      .lt("uploaded_at", fifteenMinutesAgo);

    if (docsError) {
      console.error("Error fetching pending documents:", docsError);
      throw docsError;
    }

    if (!pendingDocs || pendingDocs.length === 0) {
      console.log("No pending documents requiring reminder");
      return new Response(
        JSON.stringify({ success: true, message: "No pending documents to process", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Found ${pendingDocs.length} pending documents needing reminder`);

    // Check warmup limit
    const warmupCheck = await checkWarmupLimit(supabase);
    if (!warmupCheck.canSend) {
      console.log("Warmup limit reached, skipping emails");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: warmupCheck.reason }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get all admin users
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError || !adminRoles || adminRoles.length === 0) {
      console.log("No admin users found");
      return new Response(
        JSON.stringify({ success: true, message: "No admin users to notify" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const adminIds = adminRoles.map((r: any) => r.user_id);

    // Get admin profiles with emails
    const { data: adminProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name, email_unsubscribed")
      .in("id", adminIds)
      .neq("email_unsubscribed", true);

    if (profilesError || !adminProfiles || adminProfiles.length === 0) {
      console.log("No admin profiles found or all unsubscribed");
      return new Response(
        JSON.stringify({ success: true, message: "No admin emails to send" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending reminder to ${adminProfiles.length} admins about ${pendingDocs.length} pending documents`);

    const token = await getSendPulseToken();
    const siteUrl = Deno.env.get("SITE_URL") || "https://plagaiscans.com";

    // Create document list for email
    const documentList = pendingDocs.map((doc: any) => {
      const uploadedAt = new Date(doc.uploaded_at);
      const minutesAgo = Math.floor((Date.now() - uploadedAt.getTime()) / 60000);
      return `<li style="margin-bottom: 8px;"><strong>${doc.file_name}</strong> - waiting ${minutesAgo} minutes</li>`;
    }).join("");

    const subject = `${pendingDocs.length} Document(s) Pending Review - Action Required`;

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
            
            <h1 style="color: #18181b; margin: 0 0 20px 0; font-size: 24px;">Pending Documents Alert</h1>
            
            <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              The following ${pendingDocs.length} document(s) have been waiting for more than 15 minutes without being picked up:
            </p>
            
            <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
              <ul style="margin: 0; padding-left: 20px; color: #92400e;">
                ${documentList}
              </ul>
            </div>
            
            <p style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Please review the document queue and assign these documents to available staff.
            </p>
            
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${siteUrl}/document-queue" 
                 style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                View Document Queue
              </a>
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
              You're receiving this email because you are an administrator.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    let successCount = 0;
    let failedCount = 0;

    // Send email to each admin
    for (const admin of adminProfiles) {
      const result = await sendEmailViaSendPulse(
        token,
        { email: admin.email, name: admin.full_name || "Admin" },
        subject,
        htmlContent
      );

      if (result.success) {
        successCount++;
        await incrementEmailCounter(supabase);
      } else {
        failedCount++;
        console.error(`Failed to send to ${admin.email}:`, result.error);
      }
    }

    // Mark all pending documents as reminder sent
    const docIds = pendingDocs.map((d: any) => d.id);
    const { error: updateError } = await supabase
      .from("documents")
      .update({ pending_reminder_sent_at: new Date().toISOString() })
      .in("id", docIds);

    if (updateError) {
      console.error("Error updating reminder sent timestamp:", updateError);
    }

    // Log email
    await supabase.from("transactional_email_logs").insert({
      email_type: "pending_document_reminder",
      recipient_email: adminProfiles.map((a: any) => a.email).join(", "),
      subject: subject,
      status: successCount > 0 ? "sent" : "failed",
      metadata: { documentCount: pendingDocs.length, adminCount: adminProfiles.length, successCount, failedCount },
    });

    console.log(`Reminder emails sent: ${successCount} success, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        documentsProcessed: pendingDocs.length,
        emailsSent: successCount,
        emailsFailed: failedCount,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in check-pending-documents:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
