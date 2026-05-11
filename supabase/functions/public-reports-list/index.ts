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
  const cursor = url.searchParams.get("cursor");
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "200", 10);
  const limit = Math.min(Math.max(isNaN(limitRaw) ? 200 : limitRaw, 1), 500);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let q = admin
    .from("documents")
    .select("id, file_name, ai_report_path, uploaded_at, ai_percentage")
    .not("ai_report_path", "is", null)
    .neq("ai_report_path", "")
    .order("uploaded_at", { ascending: true })
    .limit(limit);

  if (cursor) q = q.gt("uploaded_at", cursor);

  const { data, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const items = (data ?? []).map((d: any) => ({
    id: d.id,
    filename: d.file_name,
    storage_path: d.ai_report_path,
    created_at: d.uploaded_at,
    ai_score: d.ai_percentage,
    size_bytes: null as number | null,
  }));

  const next_cursor = items.length === limit ? items[items.length - 1].created_at : null;

  return new Response(JSON.stringify({ items, next_cursor }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
