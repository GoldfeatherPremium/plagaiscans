import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAIL_CONFIG = {
  FROM_NAME: "Plagaiscans",
  FROM_EMAIL: "support@plagaiscans.com",
  REPLY_TO: "support@plagaiscans.com",
  SITE_URL: "https://plagaiscans.com",
};

const SENDPULSE_API_KEY = Deno.env.get("SENDPLUS_API_KEY");
const SENDPULSE_API_SECRET = Deno.env.get("SENDPLUS_API_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentConfirmationRequest {
  userId: string;
  amount: number;
  credits: number;
  paymentMethod: string;
  transactionId?: string;
  packageName?: string;
}

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
  if (!response.ok) throw new Error("Failed to authenticate with SendPulse");
  const data = await response.json();
  return data.access_token;
}

async function sendEmail(token: string, to: { email: string; name?: string }, subject: string, htmlContent: string) {
  const htmlBase64 = btoa(unescape(encodeURIComponent(htmlContent)));
  const textContent = htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  const response = await fetch("https://api.sendpulse.com/smtp/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      email: {
        html: htmlBase64,
        text: textContent,
        subject,
        from: { name: EMAIL_CONFIG.FROM_NAME, email: EMAIL_CONFIG.FROM_EMAIL },
        to: [{ email: to.email, name: to.name || to.email.split('@')[0] }],
        reply_to: EMAIL_CONFIG.REPLY_TO,
      },
    }),
  });

  return { success: response.ok, response: await response.json() };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, amount, credits, paymentMethod, transactionId, packageName }: PaymentConfirmationRequest = await req.json();

    console.log("Sending payment confirmation email:", { userId, amount, credits, paymentMethod });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name, email_unsubscribed")
      .eq("id", userId)
      .single();

    if (!profile) {
      throw new Error("User profile not found");
    }

    if (profile.email_unsubscribed) {
      console.log("User has unsubscribed from emails");
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userName = profile.full_name || "Customer";
    const token = await getSendPulseToken();
    const orderDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const paymentMethodDisplay = {
      'stripe': 'Credit/Debit Card',
      'usdt': 'USDT (Crypto)',
      'binance_pay': 'Binance Pay',
      'viva': 'Viva Wallet',
      'whatsapp': 'Manual Transfer',
    }[paymentMethod] || paymentMethod;

    const subject = `Payment Confirmed - ${credits} Credits Added - Plagaiscans`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <tr>
                  <td style="padding: 40px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 60px; height: 60px; border-radius: 50%; display: inline-block; line-height: 60px;">
                        <span style="color: white; font-size: 28px;">✓</span>
                      </div>
                    </div>
                    
                    <h1 style="color: #18181b; text-align: center; margin: 0 0 10px 0; font-size: 24px;">Payment Confirmed!</h1>
                    
                    <p style="color: #71717a; text-align: center; margin: 0 0 30px 0;">Hello ${userName}, thank you for your purchase!</p>
                    
                    <div style="background-color: #f0fdf4; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
                      <p style="margin: 0 0 5px 0; color: #166534; font-size: 14px;">Credits Added</p>
                      <p style="margin: 0; color: #166534; font-size: 36px; font-weight: 700;">+${credits}</p>
                    </div>
                    
                    <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #71717a;">Order Date</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #18181b; text-align: right; font-weight: 500;">${orderDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #71717a;">Package</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #18181b; text-align: right; font-weight: 500;">${packageName || `${credits} Credits`}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #71717a;">Payment Method</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #18181b; text-align: right; font-weight: 500;">${paymentMethodDisplay}</td>
                      </tr>
                      ${transactionId ? `
                      <tr>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #71717a;">Transaction ID</td>
                        <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb; color: #18181b; text-align: right; font-weight: 500; font-size: 12px;">${transactionId}</td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 12px 0; color: #18181b; font-weight: 600;">Total Paid</td>
                        <td style="padding: 12px 0; color: #18181b; text-align: right; font-weight: 700; font-size: 18px;">$${amount.toFixed(2)}</td>
                      </tr>
                    </table>
                    
                    <div style="text-align: center; margin-bottom: 20px;">
                      <a href="${EMAIL_CONFIG.SITE_URL}/dashboard/upload" 
                         style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                        Start Checking Documents
                      </a>
                    </div>
                    
                    <p style="color: #71717a; text-align: center; font-size: 13px; margin-bottom: 20px;">
                      Your credits have been added to your account and are ready to use.
                    </p>
                    
                    <div style="background-color: #fef3c7; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                      <p style="margin: 0; color: #92400e; font-size: 13px; text-align: center;">
                        <strong>Note:</strong> Purchased credits are non-refundable. Please check our <a href="${EMAIL_CONFIG.SITE_URL}/refund-policy" style="color: #6366f1;">refund policy</a> for details.
                      </p>
                    </div>
                    
                    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                      <p style="color: #6b7280; text-align: center; margin: 0 0 10px 0; font-size: 13px;">
                        Thank you for choosing Plagaiscans!<br>
                        <strong>Plagaiscans Team</strong>
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

    const result = await sendEmail(token, { email: profile.email, name: userName }, subject, htmlContent);

    // Log email
    await supabase.from("transactional_email_logs").insert({
      email_type: 'payment_confirmation',
      recipient_id: userId,
      recipient_email: profile.email,
      recipient_name: userName,
      subject,
      status: result.success ? 'sent' : 'failed',
      provider_response: result.response,
      sent_at: result.success ? new Date().toISOString() : null,
      metadata: { amount, credits, paymentMethod, transactionId },
    });

    // Send push notification
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          title: '💳 Payment Confirmed!',
          body: `${credits} credits have been added to your account.`,
          userId,
          url: '/dashboard',
          eventType: 'payment_confirmation',
        }),
      });
    } catch (e) {
      console.error('Push notification error:', e);
    }

    console.log("Payment confirmation email sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
