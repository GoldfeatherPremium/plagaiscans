import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtensionToken {
  id: string;
  user_id: string;
  is_active: boolean;
  expires_at: string | null;
  profiles: {
    email: string;
    full_name: string | null;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/extension-api", "");

    // Extract and validate token
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Missing authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate token
    const { data: tokenData, error: tokenError } = await supabase
      .from("extension_tokens")
      .select("id, user_id, is_active, expires_at, profiles(email, full_name)")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Invalid or inactive token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check token expiration
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Token has expired" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last used timestamp
    await supabase
      .from("extension_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenData.id);

    // Route handling
    // GET /pending - Fetch pending similarity documents
    if (path === "/pending" && req.method === "GET") {
      const { data: docs, error: docsError } = await supabase
        .from("documents")
        .select("id, file_name, file_path, uploaded_at, user_id, scan_type")
        .eq("scan_type", "similarity_only")
        .eq("status", "pending")
        .is("assigned_staff_id", null)
        .order("uploaded_at", { ascending: true })
        .limit(10);

      if (docsError) {
        throw docsError;
      }

      // Log the fetch action
      await supabase.from("extension_logs").insert({
        token_id: tokenData.id,
        action: "fetch_pending",
        status: "success",
        metadata: { document_count: docs?.length || 0 },
      });

      return new Response(
        JSON.stringify({ documents: docs || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /download/:documentId - Get signed download URL
    if (path.startsWith("/download/") && req.method === "GET") {
      const documentId = path.replace("/download/", "");

      // Get document details
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .select("id, file_path, file_name")
        .eq("id", documentId)
        .single();

      if (docError || !doc) {
        return new Response(
          JSON.stringify({ error: "Document not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate signed URL (valid for 5 minutes)
      const { data: signedUrl, error: urlError } = await supabase
        .storage
        .from("documents")
        .createSignedUrl(doc.file_path, 300);

      if (urlError) {
        throw urlError;
      }

      // Assign document to staff
      await supabase
        .from("documents")
        .update({
          assigned_staff_id: tokenData.user_id,
          assigned_at: new Date().toISOString(),
          status: "in_progress",
        })
        .eq("id", documentId);

      // Log the download action
      await supabase.from("extension_logs").insert({
        token_id: tokenData.id,
        action: "download",
        document_id: documentId,
        status: "success",
        metadata: { file_name: doc.file_name },
      });

      return new Response(
        JSON.stringify({ url: signedUrl?.signedUrl, fileName: doc.file_name }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /upload-report - Upload similarity report
    if (path === "/upload-report" && req.method === "POST") {
      const formData = await req.formData();
      const documentId = formData.get("documentId") as string;
      const similarityPercentage = formData.get("similarityPercentage") as string;
      const reportFile = formData.get("report") as File;
      const remarks = formData.get("remarks") as string | null;

      if (!documentId || !reportFile) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get document info
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .select("id, user_id, file_name")
        .eq("id", documentId)
        .single();

      if (docError || !doc) {
        return new Response(
          JSON.stringify({ error: "Document not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upload report file
      const reportPath = `${doc.user_id}/${documentId}/similarity_report_${Date.now()}.png`;
      const reportBuffer = await reportFile.arrayBuffer();
      
      const { error: uploadError } = await supabase
        .storage
        .from("reports")
        .upload(reportPath, reportBuffer, {
          contentType: reportFile.type || "image/png",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Update document
      const updateData: Record<string, any> = {
        status: "completed",
        completed_at: new Date().toISOString(),
        similarity_report_path: reportPath,
        similarity_percentage: similarityPercentage ? parseFloat(similarityPercentage) : null,
      };

      if (remarks) {
        updateData.remarks = remarks;
      }

      await supabase
        .from("documents")
        .update(updateData)
        .eq("id", documentId);

      // Log the action
      await supabase.from("extension_logs").insert({
        token_id: tokenData.id,
        action: "report_uploaded",
        document_id: documentId,
        status: "success",
        metadata: {
          similarity_percentage: similarityPercentage,
          report_path: reportPath,
        },
      });

      // Log activity
      await supabase.from("activity_logs").insert({
        document_id: documentId,
        staff_id: tokenData.user_id,
        action: "completed_similarity_via_extension",
      });

      return new Response(
        JSON.stringify({ success: true, documentId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /heartbeat - Extension health check
    if (path === "/heartbeat" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));

      await supabase
        .from("extension_tokens")
        .update({
          last_heartbeat_at: new Date().toISOString(),
          browser_info: body.browserInfo || null,
        })
        .eq("id", tokenData.id);

      return new Response(
        JSON.stringify({ success: true, serverTime: new Date().toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /slots - Get Turnitin slot configurations
    if (path === "/slots" && req.method === "GET") {
      // First reset any slots that need daily reset
      await supabase.rpc("reset_turnitin_slot_usage");

      const { data: slots, error: slotsError } = await supabase
        .from("turnitin_slots")
        .select("*")
        .eq("is_active", true)
        .order("slot_number", { ascending: true });

      if (slotsError) {
        throw slotsError;
      }

      return new Response(
        JSON.stringify({ slots: slots || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /slots/update-usage - Update slot usage
    if (path === "/slots/update-usage" && req.method === "POST") {
      const body = await req.json();
      const { slotId } = body;

      if (!slotId) {
        return new Response(
          JSON.stringify({ error: "Missing slotId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Increment usage
      const { data: slot, error: slotError } = await supabase
        .from("turnitin_slots")
        .select("current_usage")
        .eq("id", slotId)
        .single();

      if (slotError || !slot) {
        return new Response(
          JSON.stringify({ error: "Slot not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("turnitin_slots")
        .update({
          current_usage: slot.current_usage + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", slotId);

      return new Response(
        JSON.stringify({ success: true, newUsage: slot.current_usage + 1 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /error - Log extension error
    if (path === "/error" && req.method === "POST") {
      const body = await req.json();

      await supabase.from("extension_logs").insert({
        token_id: tokenData.id,
        action: "error",
        document_id: body.documentId || null,
        status: "error",
        error_message: body.message,
        metadata: body.metadata || {},
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unknown endpoint
    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Extension API error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
