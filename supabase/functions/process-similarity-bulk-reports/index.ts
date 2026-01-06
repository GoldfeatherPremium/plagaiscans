import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface IncomingReport {
  fileName: string;
  filePath: string;
}

interface ReportResult {
  fileName: string;
  status: "mapped" | "unmatched" | "error";
  documentId?: string;
  error?: string;
}

function normalizeFilename(filename: string): string {
  let result = filename.toLowerCase().trim();

  // Remove common "double extensions" like .docx.pdf
  const exts = [".pdf", ".docx", ".doc"];
  let changed = true;
  while (changed) {
    changed = false;
    for (const ext of exts) {
      if (result.endsWith(ext)) {
        result = result.slice(0, -ext.length);
        changed = true;
      }
    }
  }

  // Remove trailing "(1)", "(2)", ...
  result = result.replace(/\s*\(\d+\)\s*$/, "");

  // Normalize spaces
  result = result.replace(/\s+/g, " ").trim();

  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || !["admin", "staff"].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Expect JSON body: { files: [{ fileName, filePath }] }
    const body = await req.json().catch(() => null) as { files?: IncomingReport[] } | null;
    const files = body?.files;

    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ error: "No files provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: ReportResult[] = [];
    let mappedCount = 0;
    let unmatchedCount = 0;
    let completedCount = 0;

    const { data: documents, error: docError } = await supabase
      .from("documents")
      .select("id, file_name, normalized_filename, similarity_report_path, status")
      .eq("scan_type", "similarity_only")
      .in("status", ["pending", "in_progress"]);

    if (docError) throw new Error(docError.message);

    interface DocRecord {
      id: string;
      file_name: string;
      normalized_filename: string | null;
      similarity_report_path: string | null;
      status: string;
    }

    const docMap = new Map<string, DocRecord>();
    for (const doc of (documents ?? []) as DocRecord[]) {
      const key = doc.normalized_filename || normalizeFilename(doc.file_name);
      if (!docMap.has(key)) docMap.set(key, doc);
    }

    for (const report of files) {
      try {
        const key = normalizeFilename(report.fileName);
        const matchedDoc = docMap.get(key);

        if (matchedDoc) {
          const { error: updateError } = await supabase
            .from("documents")
            .update({
              similarity_report_path: report.filePath,
              status: "completed",
              completed_at: new Date().toISOString(),
              assigned_staff_id: user.id,
              assigned_at: new Date().toISOString(),
            })
            .eq("id", matchedDoc.id);

          if (updateError) throw new Error(updateError.message);

          await supabase.from("activity_logs").insert({
            staff_id: user.id,
            document_id: matchedDoc.id,
            action: "bulk_completed_similarity",
          });

          results.push({
            fileName: report.fileName,
            status: "mapped",
            documentId: matchedDoc.id,
          });

          mappedCount++;
          completedCount++;
          docMap.delete(key);
        } else {
          await supabase.from("unmatched_reports").insert({
            file_name: report.fileName,
            normalized_filename: key,
            file_path: report.filePath,
            report_type: "similarity",
            uploaded_by: user.id,
          });

          results.push({
            fileName: report.fileName,
            status: "unmatched",
          });

          unmatchedCount++;
        }
      } catch (e) {
        results.push({
          fileName: report.fileName,
          status: "error",
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          total: files.length,
          mapped: mappedCount,
          unmatched: unmatchedCount,
          completed: completedCount,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in process-similarity-bulk-reports:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
