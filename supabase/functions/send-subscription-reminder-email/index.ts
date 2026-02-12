import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAIL_CONFIG = {
  FROM_NAME: "Plagaiscans",
  FROM_EMAIL: "support@plagaiscans.com",
  REPLY_TO: "support@plagaiscans.com",
  SITE_URL: "https://plagaiscans.com",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(apiKey: string, to: { email: string; name?: string }, subject: string, htmlContent: string) {
  const response = await fetch("https://api.sender.net/v2/message/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      to: { email: to.email, name: to.name || to.email.split('@')[0] },
      from: { email: EMAIL_CONFIG.FROM_EMAIL, name: EMAIL_CONFIG.FROM_NAME },
      subject,
      html: htmlContent,
      reply_to: EMAIL_CONFIG.REPLY_TO,
    }),
  });

  const result = await response.json();
  return { success: response.ok, response: result };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    console.log("Checking for subscriptions renewing soon...");

    const subscriptions = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
    });

    const now = new Date();
    const apiKey = Deno.env.get("SENDER_NET_API_KEY");
    if (!apiKey) throw new Error("SENDER_NET_API_KEY not configured");
    let sentCount = 0;

    for (const subscription of subscriptions.data) {
      const renewalDate = new Date(subscription.current_period_end * 1000);
      const daysUntilRenewal = Math.ceil((renewalDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      if (daysUntilRenewal <= 3 && daysUntilRenewal > 0) {
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        if (!customer || customer.deleted) continue;

        const email = (customer as Stripe.Customer).email;
        if (!email) continue;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, full_name, email_unsubscribed")
          .eq("email", email)
          .single();

        if (!profile || profile.email_unsubscribed) continue;

        const userName = profile.full_name || "Customer";
        const renewalDateStr = renewalDate.toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const amount = subscription.items.data[0]?.price.unit_amount || 0;
        const amountDisplay = (amount / 100).toFixed(2);

        const subject = `Subscription Renewal in ${daysUntilRenewal} Day${daysUntilRenewal === 1 ? '' : 's'} - Plagaiscans`;

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
                        <div style="text-align: center; margin-bottom: 20px;">
                          <span style="background-color: #3b82f6; color: white; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600;">RENEWAL REMINDER</span>
                        </div>
                        
                        <h1 style="color: #18181b; text-align: center; margin: 0 0 10px 0; font-size: 24px;">Subscription Renews Soon</h1>
                        
                        <p style="color: #71717a; text-align: center; margin: 0 0 30px 0;">Hello ${userName}, your subscription will renew in ${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'}.</p>
                        
                        <div style="background-color: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                          <table style="width: 100%;">
                            <tr>
                              <td style="color: #1e40af; font-size: 14px;">Renewal Date</td>
                              <td style="color: #1e40af; text-align: right; font-weight: 600;">${renewalDateStr}</td>
                            </tr>
                            <tr>
                              <td style="color: #1e40af; font-size: 14px; padding-top: 10px;">Amount</td>
                              <td style="color: #1e40af; text-align: right; font-weight: 600; padding-top: 10px;">$${amountDisplay}</td>
                            </tr>
                          </table>
                        </div>
                        
                        <p style="color: #71717a; text-align: center; margin: 0 0 20px 0;">Your payment method will be charged automatically. If you wish to cancel or modify your subscription, please do so before the renewal date.</p>
                        
                        <div style="text-align: center;">
                          <a href="${EMAIL_CONFIG.SITE_URL}/dashboard/subscription" 
                             style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                            Manage Subscription
                          </a>
                        </div>
                        
                        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
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

        const result = await sendEmail(apiKey, { email, name: userName }, subject, htmlContent);

        if (result.success) {
          sentCount++;
          console.log(`Sent subscription renewal reminder to ${email}`);

          try {
            await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                title: '📅 Subscription Renewal Reminder',
                body: `Your subscription renews in ${daysUntilRenewal} day${daysUntilRenewal === 1 ? '' : 's'} ($${amountDisplay})`,
                userId: profile.id,
                url: '/dashboard/subscription',
                eventType: 'subscription_renewal_reminder',
              }),
            });
          } catch (e) {
            console.error('Push notification error:', e);
          }
        }
      }
    }

    console.log(`Sent ${sentCount} subscription renewal reminders`);

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
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