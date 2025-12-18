import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: PasswordResetRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    console.log("Processing password reset request for:", email);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user exists in profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("email", email)
      .single();

    if (profileError || !profile) {
      // Return success even if user doesn't exist (security best practice)
      console.log("User not found, returning success anyway for security");
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Generate password reset link using Supabase Auth
    const siteUrl = Deno.env.get("SITE_URL") || "https://fyssbzgmhnolazjfwafm.lovable.app";
    
    const { data: resetData, error: resetError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: `${siteUrl}/auth?reset=true`,
      },
    });

    if (resetError) {
      console.error("Error generating reset link:", resetError);
      throw new Error("Failed to generate reset link");
    }

    const resetLink = resetData.properties.action_link;
    const userName = profile.full_name || "User";

    console.log("Sending password reset email to:", email);

    // Send email using Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "DocCheck <onboarding@resend.dev>",
        to: [email],
        subject: "Reset Your Password",
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
                  <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); width: 60px; height: 60px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
                    <span style="color: white; font-size: 28px;">🔐</span>
                  </div>
                </div>
                
                <h1 style="color: #18181b; text-align: center; margin: 0 0 10px 0; font-size: 24px;">Reset Your Password</h1>
                
                <p style="color: #71717a; text-align: center; margin: 0 0 30px 0;">Hello ${userName}, we received a request to reset your password.</p>
                
                <div style="text-align: center; margin-bottom: 30px;">
                  <a href="${resetLink}" 
                     style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                    Reset Password
                  </a>
                </div>
                
                <p style="color: #71717a; text-align: center; margin: 0 0 20px 0; font-size: 14px;">
                  This link will expire in 24 hours.
                </p>
                
                <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
                  <p style="margin: 0; color: #92400e; font-size: 14px; text-align: center;">
                    If you didn't request this password reset, you can safely ignore this email.
                  </p>
                </div>
                
                <p style="color: #a1a1aa; text-align: center; margin: 30px 0 0 0; font-size: 12px;">
                  This is an automated email from DocCheck. Please do not reply.
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const emailResult = await emailResponse.json();
    
    if (!emailResponse.ok) {
      console.error("Resend API error:", emailResult);
      throw new Error("Failed to send email");
    }

    console.log("Password reset email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-password-reset function:", error);
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
