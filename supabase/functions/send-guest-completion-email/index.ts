import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmailViaSendPulse, isEmailEnabled, incrementEmailCounter, EMAIL_CONFIG } from "../_shared/email-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GuestEmailRequest {
  documentId: string;
  magicLinkId: string;
  fileName: string;
  similarityPercentage?: number | null;
  aiPercentage?: number | null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, magicLinkId, fileName, similarityPercentage, aiPercentage }: GuestEmailRequest = await req.json();

    console.log("Sending guest completion email for document:", documentId, "magicLinkId:", magicLinkId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const isEnabled = await isEmailEnabled(supabase, "document_completion");
    if (!isEnabled) {
      console.log("Document completion emails are disabled by admin, skipping guest email");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Email disabled by admin" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { data: magicLink, error: linkError } = await supabase
      .from("magic_upload_links")
      .select("guest_email, guest_name, token")
      .eq("id", magicLinkId)
      .single();

    if (linkError || !magicLink) {
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Magic link not found" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!magicLink.guest_email) {
      console.log("No guest email registered for this magic link, skipping");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No guest email registered" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const guestEmail = magicLink.guest_email;
    const guestName = magicLink.guest_name || "Guest";
    const guestPageUrl = `${EMAIL_CONFIG.SITE_URL}/guest-upload?token=${magicLink.token}`;
    const cleanFileName = fileName.replace(/^\[Guest\]\s*/i, '');
    const subject = "Your Document Has Been Processed - Plagaiscans";

    // Generate signed download URLs for the report files (7 days)
    const { data: docRow } = await supabase
      .from("documents")
      .select("similarity_report_path, ai_report_path")
      .eq("id", documentId)
      .maybeSingle();

    const SIGN_TTL_SECONDS = 7 * 24 * 60 * 60;
    const safeBase = (cleanFileName || "report").replace(/\.[^.]+$/, "");
    let similarityDownloadUrl: string | null = null;
    let aiDownloadUrl: string | null = null;

    if (docRow?.similarity_report_path) {
      const { data: signed } = await supabase.storage
        .from("reports")
        .createSignedUrl(docRow.similarity_report_path, SIGN_TTL_SECONDS, {
          download: `${safeBase}_similarity.pdf`,
        });
      similarityDownloadUrl = signed?.signedUrl ?? null;
    }
    if (docRow?.ai_report_path) {
      const { data: signed } = await supabase.storage
        .from("reports")
        .createSignedUrl(docRow.ai_report_path, SIGN_TTL_SECONDS, {
          download: `${safeBase}_ai.pdf`,
        });
      aiDownloadUrl = signed?.signedUrl ?? null;
    }

    const downloadButtonsHtml = (similarityDownloadUrl || aiDownloadUrl) ? `
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-top: 20px;">
        <p style="margin: 0 0 14px 0; color: #374151; font-size: 14px; font-weight: 600; text-align: center;">
          Download your reports
        </p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            ${similarityDownloadUrl ? `
            <td align="center" style="padding: 6px;">
              <a href="${similarityDownloadUrl}"
                 style="display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                ⬇ Download Similarity Report
              </a>
            </td>` : ''}
            ${aiDownloadUrl ? `
            <td align="center" style="padding: 6px;">
              <a href="${aiDownloadUrl}"
                 style="display: inline-block; background-color: #7c3aed; color: white; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                ⬇ Download AI Report
              </a>
            </td>` : ''}
          </tr>
        </table>
        <p style="margin: 14px 0 0 0; color: #6b7280; font-size: 12px; text-align: center;">
          These download links are valid for 7 days.
        </p>
      </div>
    ` : '';

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
                    
                    <p style="color: #71717a; text-align: center; margin: 0 0 30px 0;">Hello ${guestName}, your document has been analyzed and is ready for review.</p>
                    
                    <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                      <p style="margin: 0 0 10px 0; color: #71717a; font-size: 14px;">Document</p>
                      <p style="margin: 0; color: #18181b; font-weight: 600;">${cleanFileName}</p>
                    </div>
                    
                    <div style="text-align: center;">
                      <a href="${guestPageUrl}" 
                         style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                        View Your Documents
                      </a>
                    </div>

                    ${downloadButtonsHtml}

                    <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-top: 20px; border-left: 4px solid #f59e0b;">
                      <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
                        <strong>⚠️ Important:</strong> Please download your reports within <strong>7 days</strong>. 
                        After this period, the files will be automatically removed from our servers for security and privacy purposes.
                      </p>
                    </div>
                    
                    <div style="background-color: #dbeafe; border-radius: 8px; padding: 16px; margin-top: 16px; border-left: 4px solid #3b82f6;">
                      <p style="margin: 0 0 10px 0; color: #1e40af; font-size: 13px; line-height: 1.5;">
                        <strong>💡 Want more features?</strong> Create a free account to:
                      </p>
                      <ul style="margin: 0; padding-left: 20px; color: #1e40af; font-size: 13px; line-height: 1.6;">
                        <li>Track all your documents in one place</li>
                        <li>Get faster processing times</li>
                        <li>Access your reports anytime</li>
                      </ul>
                      <p style="margin: 10px 0 0 0;">
                        <a href="${EMAIL_CONFIG.SITE_URL}/auth" style="color: #2563eb; font-weight: 600;">Create Account →</a>
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

    const result = await sendEmailViaSendPulse({ email: guestEmail, name: guestName }, subject, htmlContent);

    await supabase.from("transactional_email_logs").insert({
      email_type: 'guest_document_completion',
      recipient_email: guestEmail,
      recipient_name: guestName,
      subject: subject,
      document_id: documentId,
      status: result.success ? 'sent' : 'failed',
      provider_response: result.response,
      error_message: result.error,
      sent_at: result.success ? new Date().toISOString() : null,
      metadata: { fileName: cleanFileName, magicLinkId, similarityPercentage, aiPercentage },
    });

    if (result.success) {
      await incrementEmailCounter(supabase);
    }

    if (!result.success) {
      throw new Error(result.error || "Failed to send email");
    }

    console.log("Guest completion email sent successfully to:", guestEmail);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-guest-completion-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
