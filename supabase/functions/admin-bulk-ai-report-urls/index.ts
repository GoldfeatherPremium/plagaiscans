import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { offset = 0, limit = 500 } = await req.json().catch(() => ({}));

  const { data: docs, error } = await admin
    .from("documents")
    .select("id, file_name, ai_report_path")
    .not("ai_report_path", "is", null)
    .neq("ai_report_path", "")
    .order("uploaded_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

  const paths = (docs ?? []).map((d) => d.ai_report_path as string);
  const { data: signed, error: sErr } = await admin.storage
    .from("reports")
    .createSignedUrls(paths, 3600);

  if (sErr) return new Response(JSON.stringify({ error: sErr.message }), { status: 500, headers: corsHeaders });

  const result = (docs ?? []).map((d, i) => ({
    id: d.id,
    file_name: d.file_name,
    ai_report_path: d.ai_report_path,
    signed_url: signed?.[i]?.signedUrl ?? null,
    error: signed?.[i]?.error ?? null,
  }));

  return new Response(JSON.stringify({ count: result.length, items: result }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
