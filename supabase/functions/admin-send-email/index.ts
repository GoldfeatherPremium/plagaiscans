import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  type: 'announcement' | 'payment_reminder' | 'document_status' | 'custom';
  targetAudience?: 'all' | 'customers' | 'staff' | 'specific';
  specificUserIds?: string[];
  subject: string;
  title: string;
  message: string;
  ctaText?: string;
  ctaUrl?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, targetAudience, specificUserIds, subject, title, message, ctaText, ctaUrl }: EmailRequest = await req.json();

    console.log("Admin email request:", { type, targetAudience, subject });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let emails: string[] = [];

    if (targetAudience === 'specific' && specificUserIds?.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email")
        .in("id", specificUserIds);
      
      emails = profiles?.map(p => p.email) || [];
    } else if (targetAudience === 'customers') {
      const { data: customerRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "customer");
      
      if (customerRoles?.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email")
          .in("id", customerRoles.map(r => r.user_id));
        emails = profiles?.map(p => p.email) || [];
      }
    } else if (targetAudience === 'staff') {
      const { data: staffRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "staff");
      
      if (staffRoles?.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email")
          .in("id", staffRoles.map(r => r.user_id));
        emails = profiles?.map(p => p.email) || [];
      }
    } else {
      // All users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("email");
      emails = profiles?.map(p => p.email) || [];
    }

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No recipients found" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending emails to ${emails.length} recipients`);

    const siteUrl = "https://plagaiscans.com";
    
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
              <div style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); width: 60px; height: 60px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;">
                <span style="color: white; font-size: 28px;">📧</span>
              </div>
            </div>
            
            <h1 style="color: #18181b; text-align: center; margin: 0 0 20px 0; font-size: 24px;">${title}</h1>
            
            <div style="color: #3f3f46; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
              ${message.replace(/\n/g, '<br>')}
            </div>
            
            ${ctaText && ctaUrl ? `
            <div style="text-align: center; margin-bottom: 30px;">
              <a href="${ctaUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">
                ${ctaText}
              </a>
            </div>
            ` : ''}
            
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 30px 0;">
            
            <p style="color: #a1a1aa; text-align: center; margin: 0; font-size: 12px;">
              This email was sent from PlagaiScans.<br>
              <a href="${siteUrl}" style="color: #3b82f6; text-decoration: none;">Visit our website</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send emails in batches of 50
    const batchSize = 50;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "PlagaiScans <noreply@plagaiscans.com>",
            to: batch,
            subject: subject,
            html: htmlContent,
          }),
        });

        if (emailResponse.ok) {
          successCount += batch.length;
        } else {
          const errorData = await emailResponse.json();
          console.error("Email batch error:", errorData);
          errorCount += batch.length;
        }
      } catch (error) {
        console.error("Batch send error:", error);
        errorCount += batch.length;
      }
    }

    console.log(`Email sending complete: ${successCount} success, ${errorCount} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount,
        failed: errorCount,
        total: emails.length 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in admin-send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);