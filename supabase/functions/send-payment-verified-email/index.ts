import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  userId: string;
  credits: number;
  amountUsd: number;
  paymentMethod: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, credits, amountUsd, paymentMethod }: EmailRequest = await req.json();

    console.log("Sending payment verified email for user:", userId);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user email from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name, credit_balance")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      throw new Error("User profile not found");
    }

    const userName = profile.full_name || "Customer";
    const siteUrl = Deno.env.get("SITE_URL") || "https://fyssbzgmhnolazjfwafm.lovable.app";
    const methodDisplay = paymentMethod === 'binance_pay' ? 'Binance Pay' : paymentMethod;

    // Send email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "PlagaiScans <onboarding@resend.dev>",
        to: [profile.email],
        subject: "Payment Verified - Credits Added!",
        html: `
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
                  <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); width: 60px; height: 60px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
                    <span style="color: white; font-size: 28px;">✓</span>
                  </div>
                </div>
                
                <h1 style="color: #18181b; text-align: center; margin: 0 0 10px 0; font-size: 24px;">Payment Verified!</h1>
                
                <p style="color: #71717a; text-align: center; margin: 0 0 30px 0;">Hello ${userName}, your payment has been verified and credits have been added to your account.</p>
                
                <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
                  <p style="margin: 0 0 5px 0; color: #166534; font-size: 14px;">Credits Added</p>
                  <p style="margin: 0; color: #166534; font-size: 36px; font-weight: bold;">+${credits}</p>
                </div>
                
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                  <tr>
                    <td style="width: 48%; background-color: #f4f4f5; border-radius: 8px; padding: 15px; text-align: center;">
                      <p style="margin: 0 0 5px 0; color: #71717a; font-size: 12px;">Amount Paid</p>
                      <p style="margin: 0; color: #18181b; font-size: 18px; font-weight: 600;">$${amountUsd}</p>
                    </td>
                    <td style="width: 4%;"></td>
                    <td style="width: 48%; background-color: #f4f4f5; border-radius: 8px; padding: 15px; text-align: center;">
                      <p style="margin: 0 0 5px 0; color: #71717a; font-size: 12px;">Payment Method</p>
                      <p style="margin: 0; color: #18181b; font-size: 18px; font-weight: 600;">${methodDisplay}</p>
                    </td>
                  </tr>
                </table>
                
                <div style="background-color: #fef3c7; border-radius: 8px; padding: 15px; margin-bottom: 20px; text-align: center;">
                  <p style="margin: 0 0 5px 0; color: #92400e; font-size: 12px;">New Balance</p>
                  <p style="margin: 0; color: #92400e; font-size: 24px; font-weight: bold;">${profile.credit_balance} Credits</p>
                </div>
                
                <div style="text-align: center;">
                  <a href="${siteUrl}/dashboard/upload" 
                     style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                    Upload Document Now
                  </a>
                </div>
                
                <p style="color: #a1a1aa; text-align: center; margin: 30px 0 0 0; font-size: 12px;">
                  Thank you for using PlagaiScans. If you have any questions, please contact support.
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("Email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, emailResult }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-payment-verified-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
