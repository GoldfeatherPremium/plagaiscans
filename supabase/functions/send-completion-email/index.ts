import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  documentId: string;
  userId: string;
  fileName: string;
  similarityPercentage: number;
  aiPercentage: number;
}

// Check if email setting is enabled
async function isEmailEnabled(supabase: any, settingKey: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("email_settings")
      .select("is_enabled")
      .eq("setting_key", settingKey)
      .single();
    
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
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, userId, fileName, similarityPercentage, aiPercentage }: EmailRequest = await req.json();

    console.log("Sending completion email for document:", documentId);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if document completion emails are enabled
    const isEnabled = await isEmailEnabled(supabase, "document_completion");
    if (!isEnabled) {
      console.log("Document completion emails are disabled by admin, skipping");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Email disabled by admin" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get user email from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("Error fetching profile:", profileError);
      throw new Error("User profile not found");
    }

    const userName = profile.full_name || "Customer";
    const siteUrl = Deno.env.get("SITE_URL") || "https://plagaiscans.com";

    // Send email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "PlagaiScans <noreply@plagaiscans.com>",
        to: [profile.email],
        subject: "Your Document Has Been Processed!",
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
                    <span style="color: white; font-size: 28px;">✓</span>
                  </div>
                </div>
                
                <h1 style="color: #18181b; text-align: center; margin: 0 0 10px 0; font-size: 24px;">Document Processing Complete!</h1>
                
                <p style="color: #71717a; text-align: center; margin: 0 0 30px 0;">Hello ${userName}, your document has been analyzed.</p>
                
                <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                  <p style="margin: 0 0 10px 0; color: #71717a; font-size: 14px;">Document</p>
                  <p style="margin: 0; color: #18181b; font-weight: 600;">${fileName}</p>
                </div>
                
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                  <tr>
                    <td style="width: 48%; background-color: #fef3c7; border-radius: 8px; padding: 20px; text-align: center;">
                      <p style="margin: 0 0 5px 0; color: #92400e; font-size: 14px;">Similarity</p>
                      <p style="margin: 0; color: #92400e; font-size: 28px; font-weight: bold;">${similarityPercentage}%</p>
                    </td>
                    <td style="width: 4%;"></td>
                    <td style="width: 48%; background-color: #dbeafe; border-radius: 8px; padding: 20px; text-align: center;">
                      <p style="margin: 0 0 5px 0; color: #1e40af; font-size: 14px;">AI Detection</p>
                      <p style="margin: 0; color: #1e40af; font-size: 28px; font-weight: bold;">${aiPercentage}%</p>
                    </td>
                  </tr>
                </table>
                
                <div style="text-align: center;">
                  <a href="${siteUrl}/dashboard/documents" 
                     style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                    View Full Report
                  </a>
                </div>
                
                <p style="color: #a1a1aa; text-align: center; margin: 30px 0 0 0; font-size: 12px;">
                  This is an automated email from PlagaiScans. Please do not reply.
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
    console.error("Error in send-completion-email function:", error);
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