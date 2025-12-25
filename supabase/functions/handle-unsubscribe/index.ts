import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UnsubscribeRequest {
  userId: string;
  token?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, token }: UnsubscribeRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing user ID" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Processing unsubscribe request for user: ${userId.substring(0, 8)}...`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate the token if provided (basic validation)
    if (token) {
      try {
        const decoded = atob(token);
        const [tokenUserId] = decoded.split(':');
        if (tokenUserId !== userId) {
          console.error("Token mismatch");
          return new Response(
            JSON.stringify({ success: false, error: "Invalid token" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      } catch {
        console.error("Invalid token format");
        return new Response(
          JSON.stringify({ success: false, error: "Invalid token" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Check if user exists
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("id, email_unsubscribed")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError || !profile) {
      console.error("User not found:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Already unsubscribed
    if (profile.email_unsubscribed) {
      return new Response(
        JSON.stringify({ success: true, message: "Already unsubscribed" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Update the unsubscribe status
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ email_unsubscribed: true })
      .eq("id", userId);

    if (updateError) {
      console.error("Failed to unsubscribe:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to unsubscribe" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Successfully unsubscribed user: ${userId.substring(0, 8)}...`);

    return new Response(
      JSON.stringify({ success: true, message: "Successfully unsubscribed" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in handle-unsubscribe function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
