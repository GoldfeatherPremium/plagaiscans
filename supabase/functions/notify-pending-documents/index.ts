import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmailViaSendPulse, sleep, EMAIL_CONFIG } from "../_shared/email-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting pending document notification check...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: enabledSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "pending_notification_enabled")
      .maybeSingle();

    if (enabledSetting?.value === "false") {
      console.log("Pending document notifications are disabled");
      return new Response(
        JSON.stringify({ message: "Feature disabled", notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: thresholdSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "pending_notification_minutes")
      .maybeSingle();

    const thresholdMinutes = thresholdSetting ? parseInt(thresholdSetting.value) : 15;
    console.log(`Threshold: ${thresholdMinutes} minutes`);

    const cutoffTime = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();

    const { data: pendingDocuments, error: fetchError } = await supabase
      .from("documents")
      .select("id, file_name, user_id, uploaded_at, pending_reminder_sent_at, scan_type")
      .eq("status", "pending")
      .is("assigned_staff_id", null)
      .is("pending_reminder_sent_at", null)
      .lt("uploaded_at", cutoffTime);

    if (fetchError) {
      console.error("Error fetching pending documents:", fetchError);
      throw fetchError;
    }

    if (!pendingDocuments || pendingDocuments.length === 0) {
      console.log("No pending documents requiring notification");
      return new Response(
        JSON.stringify({ message: "No pending documents found", notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${pendingDocuments.length} pending documents to notify about`);

    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles || adminRoles.length === 0) {
      console.log("No admins found to notify");
      return new Response(
        JSON.stringify({ message: "No admins to notify", notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminIds = adminRoles.map((r) => r.user_id);

    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", adminIds);

    if (!adminProfiles || adminProfiles.length === 0) {
      console.log("No admin profiles found");
      return new Response(
        JSON.stringify({ message: "No admin profiles found", notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group documents by scan type / queue
    const aiScanDocs = pendingDocuments.filter((doc) => doc.scan_type === 'full');
    const similarityDocs = pendingDocuments.filter((doc) => doc.scan_type === 'similarity_only');

    const buildDocList = (docs: typeof pendingDocuments) =>
      docs
        .map((doc) => {
          const uploadedAt = new Date(doc.uploaded_at);
          const minutesAgo = Math.floor((Date.now() - uploadedAt.getTime()) / 60000);
          return `• ${doc.file_name} (${minutesAgo} minutes ago)`;
        })
        .join("\n");

    const queueParts: string[] = [];
    if (aiScanDocs.length > 0) queueParts.push(`${aiScanDocs.length} in AI Scan Queue`);
    if (similarityDocs.length > 0) queueParts.push(`${similarityDocs.length} in Similarity Queue`);
    const subjectSummary = queueParts.join(', ');

    const subject = `⚠️ ${subjectSummary} - Plagaiscans`;

    const buildQueueBlock = (title: string, docs: typeof pendingDocuments, color: string) => {
      if (docs.length === 0) return '';
      return `
        <div style="background-color: #fef3c7; border-radius: 8px; padding: 20px; margin-bottom: 20px; border-left: 4px solid ${color};">
          <p style="margin: 0 0 10px 0; color: #92400e; font-weight: 600;">${docs.length} Document${docs.length > 1 ? "s" : ""} pending in ${title}:</p>
          <pre style="margin: 0; color: #78350f; font-family: inherit; white-space: pre-wrap; font-size: 14px;">${buildDocList(docs)}</pre>
        </div>
      `;
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pending Documents Alert</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="padding: 40px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); width: 60px; height: 60px; border-radius: 12px; display: inline-block; line-height: 60px;">
                        <span style="color: white; font-size: 28px;">⚠️</span>
                      </div>
                    </div>
                    
                    <h1 style="color: #18181b; text-align: center; margin: 0 0 10px 0; font-size: 24px;">Pending Documents Alert</h1>
                    
                    <p style="color: #71717a; text-align: center; margin: 0 0 30px 0;">
                      The following documents have been pending for more than ${thresholdMinutes} minutes without being picked up by staff.
                    </p>
                    
                    ${buildQueueBlock('AI Scan Queue', aiScanDocs, '#ef4444')}
                    ${buildQueueBlock('Similarity Queue', similarityDocs, '#f59e0b')}
                    
                    <div style="text-align: center; margin-bottom: 30px;">
                      <a href="${EMAIL_CONFIG.SITE_URL}/dashboard/queue" 
                         style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                        View Document Queue
                      </a>
                    </div>
                    
                    <p style="color: #71717a; text-align: center; margin: 0 0 20px 0; font-size: 14px;">
                      Please assign staff or check why documents are not being picked up.
                    </p>
                    
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

    let successCount = 0;
    let failedCount = 0;

    for (const admin of adminProfiles) {
      console.log(`Sending notification to admin: ${admin.email}`);
      const result = await sendEmailViaSendPulse(
        { email: admin.email, name: admin.full_name || "Admin" },
        subject,
        htmlContent
      );

      if (result.success) {
        successCount++;
        console.log(`Notification sent to ${admin.email}`);
      } else {
        failedCount++;
        console.error(`Failed to send to ${admin.email}:`, result.error);
      }

      await sleep(500);
    }

    const documentIds = pendingDocuments.map((d) => d.id);
    await supabase
      .from("documents")
      .update({ pending_reminder_sent_at: new Date().toISOString() })
      .in("id", documentIds);

    console.log(`Notification complete: ${successCount} sent, ${failedCount} failed`);

    await supabase.from("transactional_email_logs").insert({
      email_type: "pending_document_alert",
      recipient_email: adminProfiles.map((a) => a.email).join(", "),
      subject: subject,
      status: failedCount === 0 ? "sent" : successCount > 0 ? "partial" : "failed",
      metadata: {
        documentCount: pendingDocuments.length,
        thresholdMinutes,
        adminCount: adminProfiles.length,
        successCount,
        failedCount,
      },
    });

    return new Response(
      JSON.stringify({
        message: `Notified ${successCount} admins about ${pendingDocuments.length} pending documents`,
        notified: successCount,
        failed: failedCount,
        documentsCount: pendingDocuments.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error in notify-pending-documents:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
