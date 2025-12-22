import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SENDPULSE_API_KEY = Deno.env.get("SENDPLUS_API_KEY");
const SENDPULSE_API_SECRET = Deno.env.get("SENDPLUS_API_SECRET");
const SENDPULSE_FROM_EMAIL = Deno.env.get("SENDPLUS_FROM_EMAIL") || "noreply@plagaiscans.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  userId: string;
  email: string;
  fullName?: string;
}

// Get SendPulse access token
async function getSendPulseToken(): Promise<string> {
  const response = await fetch("https://api.sendpulse.com/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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

// Send email via SendPulse SMTP API
async function sendEmailViaSendPulse(
  token: string,
  to: { email: string; name?: string },
  subject: string,
  htmlContent: string
): Promise<void> {
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
          name: "PlagaiScans",
          email: SENDPULSE_FROM_EMAIL,
        },
        to: [
          {
            email: to.email,
            name: to.name || to.email,
          },
        ],
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("SendPulse send error:", errorText);
    throw new Error(`Failed to send email: ${errorText}`);
  }

  const result = await response.json();
  console.log("SendPulse response:", result);
}

// Check if email setting is enabled
async function isEmailEnabled(supabase: any, settingKey: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("email_settings")
      .select("is_enabled")
      .eq("setting_key", settingKey)
      .maybeSingle();
    
    if (error || !data) {
      console.log(`Email setting ${settingKey} not found, defaulting to enabled`);
      return true;
    }
    
    return data.is_enabled;
  } catch (error) {
    console.error("Error checking email setting:", error);
    return true;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, email, fullName }: EmailRequest = await req.json();

    console.log("Sending welcome email to:", email, "userId:", userId);

    if (!SENDPULSE_API_KEY || !SENDPULSE_API_SECRET) {
      console.error("SendPulse credentials not configured");
      throw new Error("Email service is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if welcome emails are enabled
    const isEnabled = await isEmailEnabled(supabase, "welcome_email");
    if (!isEnabled) {
      console.log("Welcome emails are disabled by admin, skipping");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Email disabled by admin" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userName = fullName || "Customer";
    const siteUrl = Deno.env.get("SITE_URL") || "https://plagaiscans.com";

    const token = await getSendPulseToken();

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
              <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); width: 60px; height: 60px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
                <span style="color: white; font-size: 28px;">🎉</span>
              </div>
            </div>
            
            <h1 style="color: #18181b; text-align: center; margin: 0 0 10px 0; font-size: 24px;">Welcome to PlagaiScans!</h1>
            
            <p style="color: #71717a; text-align: center; margin: 0 0 30px 0;">Hello ${userName}, thank you for joining us!</p>
            
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <h3 style="color: #18181b; margin: 0 0 15px 0;">What you can do:</h3>
              <ul style="color: #71717a; margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 10px;">Upload documents for plagiarism and AI detection</li>
                <li style="margin-bottom: 10px;">Get detailed similarity and AI reports</li>
                <li style="margin-bottom: 10px;">Download professional reports</li>
                <li style="margin-bottom: 0;">Track all your documents in one place</li>
              </ul>
            </div>
            
            <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
              <p style="margin: 0; color: #166534; font-weight: 600;">We ensure all files are processed in Non-Repository Turnitin Instructor Accounts. Your data will not be saved.</p>
            </div>
            
            <div style="text-align: center;">
              <a href="${siteUrl}/dashboard" 
                 style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                Go to Dashboard
              </a>
            </div>
            
            <p style="color: #a1a1aa; text-align: center; margin: 30px 0 0 0; font-size: 12px;">
              If you have any questions, contact us via WhatsApp support.<br>
              Thank you for choosing PlagaiScans! 🙏
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmailViaSendPulse(
      token,
      { email, name: userName },
      "Welcome to PlagaiScans! 🎉",
      htmlContent
    );

    console.log("Welcome email sent successfully to:", email);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
