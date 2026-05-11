import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const expected = Deno.env.get("INGEST_TOKEN") ?? "";
  const auth = req.headers.get("Authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!expected || !provided || !timingSafeEqual(expected, provided)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const path = url.searchParams.get("path") ?? "";

  // Validate path: no traversal, no leading slash, must be a plausible storage object key
  if (
    !path ||
    path.includes("..") ||
    path.startsWith("/") ||
    path.length > 1024
  ) {
    return new Response(JSON.stringify({ error: "Invalid path" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Confirm the path is actually referenced as an ai_report_path in documents
  // (prevents arbitrary bucket reads even with a valid token).
  const { data: doc, error: lookupErr } = await admin
    .from("documents")
    .select("id, file_name")
    .eq("ai_report_path", path)
    .limit(1)
    .maybeSingle();

  if (lookupErr || !doc) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: blob, error: dlErr } = await admin.storage.from("reports").download(path);
  if (dlErr || !blob) {
    return new Response(JSON.stringify({ error: dlErr?.message ?? "Download failed" }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const basename = (doc.file_name ?? path.split("/").pop() ?? "report.pdf").replace(/"/g, "");
  const filename = basename.toLowerCase().endsWith(".pdf") ? basename : `${basename}.pdf`;

  return new Response(blob, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
