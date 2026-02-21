import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmailViaSendPulse, wrapEmailContent, getEmailFooter } from "../_shared/email-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdminPaymentNotificationRequest {
  customerEmail: string;
  customerName: string;
  amount: number;
  credits: number;
  paymentMethod: string;
  transactionId?: string;
  creditType?: string;
  currency?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if admin payment email notifications are enabled
    const { data: setting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "admin_payment_email_enabled")
      .single();

    if (!setting || setting.value !== "true") {
      console.log("Admin payment email notifications are disabled");
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get admin email addresses to notify
    const { data: adminEmailSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "admin_payment_notify_emails")
      .single();

    if (!adminEmailSetting || !adminEmailSetting.value?.trim()) {
      console.log("No admin emails configured for payment notifications");
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      customerEmail,
      customerName,
      amount,
      credits,
      paymentMethod,
      transactionId,
      creditType = "full",
      currency = "USD",
    }: AdminPaymentNotificationRequest = await req.json();

    console.log("Sending admin payment notification:", { customerEmail, amount, credits, paymentMethod });

    const adminEmails = adminEmailSetting.value.split(",").map((e: string) => e.trim()).filter(Boolean);

    const paymentMethodDisplay: Record<string, string> = {
      stripe: "Stripe (Card)",
      paddle: "Paddle (Card)",
      paypal: "PayPal",
      usdt: "USDT (Crypto)",
      binance_pay: "Binance Pay",
      viva: "Viva Wallet",
      dodo: "Dodo Payments",
      whatsapp: "Manual Transfer",
    };

    const methodLabel = paymentMethodDisplay[paymentMethod] || paymentMethod;
    const creditLabel = creditType === "similarity_only" ? "Similarity" : "Full (AI Scan)";
    const orderDate = new Date().toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });

    const subject = `💰 New Payment: ${customerName || customerEmail} - ${credits} Credits ($${amount.toFixed(2)} ${currency})`;

    const content = `
      <h1 style="color: #18181b; text-align: center; margin: 0 0 10px 0; font-size: 22px;">New Payment Received 💰</h1>
      <p style="color: #71717a; text-align: center; margin: 0 0 25px 0;">A customer has just completed a payment</p>
      
      <div style="background-color: #f0fdf4; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
        <p style="margin: 0 0 5px 0; color: #166534; font-size: 14px;">Amount Paid</p>
        <p style="margin: 0; color: #166534; font-size: 32px; font-weight: 700;">$${amount.toFixed(2)} ${currency}</p>
      </div>

      <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #71717a;">Customer</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #18181b; text-align: right; font-weight: 500;">${customerName || "N/A"}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #71717a;">Email</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #18181b; text-align: right; font-weight: 500;">${customerEmail}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #71717a;">Credits</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #18181b; text-align: right; font-weight: 500;">${credits} (${creditLabel})</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #71717a;">Payment Method</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #18181b; text-align: right; font-weight: 500;">${methodLabel}</td>
        </tr>
        ${transactionId ? `
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #71717a;">Transaction ID</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; color: #18181b; text-align: right; font-weight: 500; font-size: 12px;">${transactionId}</td>
        </tr>
        ` : ""}
        <tr>
          <td style="padding: 10px 0; color: #71717a;">Date</td>
          <td style="padding: 10px 0; color: #18181b; text-align: right; font-weight: 500; font-size: 13px;">${orderDate} UTC</td>
        </tr>
      </table>

      ${getEmailFooter()}
    `;

    const htmlContent = wrapEmailContent(content, "💰", "New Payment Notification");

    // Send to each admin
    const results = await Promise.all(
      adminEmails.map((email: string) =>
        sendEmailViaSendPulse({ email, name: "Admin" }, subject, htmlContent)
      )
    );

    const allSuccess = results.every((r) => r.success);
    console.log("Admin payment notification results:", results.map((r) => r.success));

    return new Response(JSON.stringify({ success: allSuccess, sent: adminEmails.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error sending admin payment notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
