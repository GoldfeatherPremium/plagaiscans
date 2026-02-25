import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmailViaSendPulse, wrapEmailContent, getEmailFooter, isEmailEnabled, logEmail, incrementEmailCounter, EMAIL_CONFIG } from "../_shared/email-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticketId, ticketSubject, messagePreview } = await req.json();

    if (!ticketId) {
      return new Response(JSON.stringify({ error: "ticketId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if this email type is enabled
    const enabled = await isEmailEnabled(supabase, "support_reply_email");
    if (!enabled) {
      console.log("Support reply email is disabled");
      return new Response(JSON.stringify({ success: false, reason: "disabled" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get ticket info including user
    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .select("id, subject, user_id")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error("Ticket not found:", ticketError);
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if no user_id (anonymous ticket)
    if (!ticket.user_id || ticket.user_id === "00000000-0000-0000-0000-000000000000") {
      console.log("Skipping email for anonymous ticket");
      return new Response(JSON.stringify({ success: false, reason: "anonymous_ticket" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", ticket.user_id)
      .single();

    if (!profile?.email) {
      console.log("No email found for user");
      return new Response(JSON.stringify({ success: false, reason: "no_email" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerName = profile.full_name || profile.email.split("@")[0];
    const subject = `New Reply on Your Support Ticket - PlagaiScans`;
    const truncatedPreview = messagePreview && messagePreview.length > 200
      ? messagePreview.substring(0, 200) + "..."
      : messagePreview || "";

    const content = `
      <h1 style="color: #18181b; text-align: center; margin: 0 0 20px 0; font-size: 24px;">You Have a New Reply</h1>
      <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
        Hi ${customerName},
      </p>
      <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
        Our support team has replied to your ticket: <strong>"${ticketSubject || ticket.subject}"</strong>
      </p>
      ${truncatedPreview ? `
      <div style="background-color: #f4f4f5; border-left: 4px solid #6366f1; padding: 16px; border-radius: 8px; margin: 20px 0;">
        <p style="color: #3f3f46; font-size: 14px; line-height: 1.6; margin: 0; font-style: italic;">
          "${truncatedPreview}"
        </p>
      </div>` : ""}
      <p style="color: #3f3f46; font-size: 16px; line-height: 1.6;">
        Please log in to your dashboard to view the full message and reply.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${EMAIL_CONFIG.SITE_URL}/dashboard/support" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">View Ticket</a>
      </div>
      ${getEmailFooter()}
    `;

    const htmlContent = wrapEmailContent(content, "💬", "Support Reply");

    // Log the email attempt to transactional_email_logs
    const logId = await logEmail(supabase, {
      emailType: "support_reply",
      recipientId: ticket.user_id,
      recipientEmail: profile.email,
      recipientName: customerName,
      subject,
      status: "pending",
    });

    // Also log to email_logs so it appears in admin Email Center
    const { data: emailLogEntry } = await supabase
      .from("email_logs")
      .insert({
        type: "custom",
        subject,
        title: "Support Reply Notification",
        message: `Auto-sent support reply email for ticket: "${ticketSubject || ticket.subject}"`,
        target_audience: `support:${profile.email}`,
        recipient_count: 1,
        status: "sending",
      })
      .select("id")
      .single();

    // Send email
    const result = await sendEmailViaSendPulse(
      { email: profile.email, name: customerName },
      subject,
      htmlContent
    );

    // Update transactional log
    if (logId) {
      const { updateEmailLog } = await import("../_shared/email-utils.ts");
      await updateEmailLog(supabase, logId, {
        status: result.success ? "sent" : "failed",
        providerResponse: result.response,
        errorMessage: result.error,
      });
    }

    // Update email_logs entry
    if (emailLogEntry?.id) {
      await supabase.from("email_logs").update({
        status: result.success ? "sent" : "failed",
        success_count: result.success ? 1 : 0,
        failed_count: result.success ? 0 : 1,
        sent_at: new Date().toISOString(),
      }).eq("id", emailLogEntry.id);

      // Also log to email_send_logs for per-recipient tracking
      await supabase.from("email_send_logs").insert({
        email_log_id: emailLogEntry.id,
        recipient_id: ticket.user_id,
        status: result.success ? "sent" : "failed",
        error_message: result.error || null,
      });
    }

    if (result.success) {
      await incrementEmailCounter(supabase);
      console.log(`Support reply email sent to ${profile.email}`);
    } else {
      console.error(`Failed to send support reply email:`, result.error);
    }

    return new Response(
      JSON.stringify({ success: result.success, error: result.error }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-support-reply-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
