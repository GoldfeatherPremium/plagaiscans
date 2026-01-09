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
}

// Validate extension token
async function validateToken(supabaseClient: any, token: string): Promise<ExtensionToken | null> {
  const { data, error } = await supabaseClient
    .from("extension_tokens")
    .select("id, user_id, is_active, expires_at")
    .eq("token", token)
    .single();

  if (error || !data) return null;
  if (!data.is_active) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  await supabaseClient
    .from("extension_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return data as ExtensionToken;
}

// Log extension activity
async function logActivity(
  supabaseClient: any,
  tokenId: string,
  action: string,
  documentId?: string,
  status?: string,
  errorMessage?: string,
  metadata?: Record<string, unknown>
) {
  await supabaseClient.from("extension_logs").insert({
    token_id: tokenId,
    action,
    document_id: documentId || null,
    status,
    error_message: errorMessage || null,
    metadata: metadata || {},
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const endpoint = pathParts[pathParts.length - 1] || "";
    const secondLastPart = pathParts[pathParts.length - 2] || "";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace("Bearer ", "");
    const tokenData = await validateToken(supabase, token);

    if (!tokenData) {
      return new Response(JSON.stringify({ error: "Invalid token" }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /pending - Fetch pending similarity documents
    if (req.method === "GET" && endpoint === "pending") {
      await logActivity(supabase, tokenData.id, "fetch_pending");

      const { data: docs, error } = await supabase
        .from("documents")
        .select("id, file_name, file_path, uploaded_at, user_id")
        .eq("scan_type", "similarity_only")
        .eq("status", "pending")
        .is("assigned_staff_id", null)
        .order("uploaded_at", { ascending: true })
        .limit(10);

      if (error) throw error;

      return new Response(JSON.stringify({ documents: docs || [] }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /download/:id - Download document
    if (req.method === "GET" && secondLastPart === "download") {
      const documentId = endpoint;
      
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .select("file_path, file_name")
        .eq("id", documentId)
        .single();

      if (docError || !doc) {
        return new Response(JSON.stringify({ error: "Document not found" }), 
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("documents").update({
        assigned_staff_id: tokenData.user_id,
        assigned_at: new Date().toISOString(),
        status: "in_progress",
      }).eq("id", documentId);

      const { data: signedUrl } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.file_path, 3600);

      return new Response(JSON.stringify({ url: signedUrl?.signedUrl, file_name: doc.file_name }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /upload-report - Upload similarity report
    if (req.method === "POST" && endpoint === "upload-report") {
      const body = await req.json();
      const { document_id, similarity_percentage, report_base64, report_filename, remarks } = body;

      if (!document_id || !report_base64) {
        return new Response(JSON.stringify({ error: "Missing fields" }), 
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const binaryString = atob(report_base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const reportPath = `${document_id}/similarity_${Date.now()}_${report_filename || "report.pdf"}`;
      await supabase.storage.from("reports").upload(reportPath, bytes, { contentType: "application/pdf" });

      await supabase.from("documents").update({
        similarity_report_path: reportPath,
        similarity_percentage,
        remarks: remarks || null,
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", document_id);

      await logActivity(supabase, tokenData.id, "upload_report_complete", document_id, "success");

      return new Response(JSON.stringify({ success: true }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /heartbeat
    if (req.method === "POST" && endpoint === "heartbeat") {
      const body = await req.json();
      await supabase.from("extension_tokens").update({
        last_heartbeat_at: new Date().toISOString(),
        browser_info: body.browser_info || null,
      }).eq("id", tokenData.id);

      return new Response(JSON.stringify({ success: true }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // GET /slots
    if (req.method === "GET" && endpoint === "slots") {
      const { data: slots } = await supabase
        .from("turnitin_slots")
        .select("*")
        .eq("is_active", true)
        .order("slot_number", { ascending: true });

      return new Response(JSON.stringify({ slots: slots || [] }), 
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), 
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), 
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
