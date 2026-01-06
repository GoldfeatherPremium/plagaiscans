import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Normalize filename for matching
function normalizeFilename(filename: string): string {
  let result = filename.toLowerCase().trim();
  
  // Remove all file extensions
  const exts = [".pdf", ".docx", ".doc", ".txt"];
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
  
  // Remove trailing (1), (2), etc.
  result = result.replace(/\s*\(\d+\)\s*$/, "");
  
  // Normalize spaces and special characters
  result = result.replace(/[_-]+/g, " ");
  result = result.replace(/\s+/g, " ").trim();
  
  return result;
}

// Extract similarity percentage from text
function extractSimilarityPercentage(text: string): { percentage: number | null; needsReview: boolean; reviewReason: string | null } {
  if (!text) {
    return { percentage: null, needsReview: true, reviewReason: "No text extracted from PDF" };
  }
  
  const lowerText = text.toLowerCase();
  
  // Check for valid similarity report indicators
  const validIndicators = ["overall similarity", "match groups", "integrity overview", "similarity index", "similarity score"];
  const hasValidIndicator = validIndicators.some(indicator => lowerText.includes(indicator));
  
  if (!hasValidIndicator) {
    return { percentage: null, needsReview: true, reviewReason: "Not a valid similarity report - missing required indicators" };
  }
  
  // Extract percentage patterns
  const patterns = [
    /(\d{1,3})%\s*overall\s*similarity/i,
    /overall\s*similarity[:\s]*(\d{1,3})%/i,
    /similarity\s*index[:\s]*(\d{1,3})%/i,
    /similarity\s*score[:\s]*(\d{1,3})%/i,
    /(\d{1,3})%\s*similarity/i,
    /similarity[:\s]*(\d{1,3})%/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const pct = parseInt(match[1], 10);
      if (pct >= 0 && pct <= 100) {
        return { percentage: pct, needsReview: false, reviewReason: null };
      }
    }
  }
  
  // Percentage not found but has valid indicators
  return { percentage: null, needsReview: true, reviewReason: "Valid report but percentage could not be extracted" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth
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

    // Check admin/staff role
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

    const body = await req.json().catch(() => null);
    const action = body?.action || "upload";

    if (action === "upload") {
      // Handle file upload - files are uploaded client-side, we just create queue entries
      const files = body?.files as { fileName: string; filePath: string }[] | undefined;

      if (!files || files.length === 0) {
        return new Response(JSON.stringify({ error: "No files provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Processing ${files.length} files for queue insertion`);

      const results: { fileName: string; status: string; queueId?: string; error?: string }[] = [];
      let queuedCount = 0;

      for (const file of files) {
        try {
          const normalized = normalizeFilename(file.fileName);
          
          const { data: queueEntry, error: insertError } = await supabase
            .from("similarity_queue")
            .insert({
              original_filename: file.fileName,
              normalized_filename: normalized,
              report_path: file.filePath,
              queue_status: "queued",
              uploaded_by: user.id,
            })
            .select("id")
            .single();

          if (insertError) {
            console.error(`Error inserting queue entry for ${file.fileName}:`, insertError);
            results.push({ fileName: file.fileName, status: "error", error: insertError.message });
          } else {
            results.push({ fileName: file.fileName, status: "queued", queueId: queueEntry.id });
            queuedCount++;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error(`Error processing ${file.fileName}:`, message);
          results.push({ fileName: file.fileName, status: "error", error: message });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          results,
          summary: {
            total: files.length,
            queued: queuedCount,
            errors: files.length - queuedCount,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "process") {
      // Process queued items - read PDF and extract percentage
      const limit = body?.limit || 10;
      
      // Get queued items
      const { data: queuedItems, error: fetchError } = await supabase
        .from("similarity_queue")
        .select("*")
        .eq("queue_status", "queued")
        .order("uploaded_at", { ascending: true })
        .limit(limit);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (!queuedItems || queuedItems.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No queued items to process", processed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Processing ${queuedItems.length} queued items`);

      let processedCount = 0;
      let completedCount = 0;
      let failedCount = 0;

      for (const item of queuedItems) {
        try {
          // Mark as processing
          await supabase
            .from("similarity_queue")
            .update({ queue_status: "processing" })
            .eq("id", item.id);

          // Download PDF from storage
          const { data: fileData, error: downloadError } = await supabase.storage
            .from("similarity-reports")
            .download(item.report_path);

          if (downloadError || !fileData) {
            console.error(`Failed to download ${item.report_path}:`, downloadError);
            await supabase
              .from("similarity_queue")
              .update({
                queue_status: "failed",
                needs_review: true,
                review_reason: "Failed to download PDF file",
              })
              .eq("id", item.id);
            failedCount++;
            continue;
          }

          // Simple text extraction attempt (without heavy PDF library)
          // For now, mark as needing review if we can't parse
          // In production, you'd use a proper PDF parser
          let extractedText = "";
          try {
            const arrayBuffer = await fileData.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            // Try to extract text from PDF bytes (simple approach)
            const textContent = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
            // Look for text streams in PDF
            const textMatches = textContent.match(/\((.*?)\)/g) || [];
            extractedText = textMatches.join(" ").replace(/[()]/g, "");
          } catch (parseErr) {
            console.error(`PDF parse error for ${item.original_filename}:`, parseErr);
          }

          const { percentage, needsReview, reviewReason } = extractSimilarityPercentage(extractedText);

          await supabase
            .from("similarity_queue")
            .update({
              queue_status: needsReview ? "completed" : "completed",
              similarity_percentage: percentage,
              needs_review: needsReview,
              review_reason: reviewReason,
              processed_at: new Date().toISOString(),
            })
            .eq("id", item.id);

          completedCount++;
          processedCount++;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          console.error(`Error processing item ${item.id}:`, message);
          
          await supabase
            .from("similarity_queue")
            .update({
              queue_status: "failed",
              needs_review: true,
              review_reason: message,
            })
            .eq("id", item.id);
          
          failedCount++;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          processed: processedCount,
          completed: completedCount,
          failed: failedCount,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in process-similarity-bulk:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
