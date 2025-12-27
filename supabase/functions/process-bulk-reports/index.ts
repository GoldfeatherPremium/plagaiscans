import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore - pdf-parse types
import pdf from "https://esm.sh/pdf-parse@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportFile {
  fileName: string;
  filePath: string;
}

interface ClassificationResult {
  reportType: 'similarity' | 'ai' | 'unknown';
  percentage: number | null;
  rawText: string;
}

interface ProcessingResult {
  success: boolean;
  mapped: { documentId: string; fileName: string; reportType: string; percentage: number | null }[];
  unmatched: { fileName: string; normalizedFilename: string; filePath: string; reportType: string | null; percentage: number | null }[];
  completedDocuments: string[];
  stats: {
    totalReports: number;
    mappedCount: number;
    unmatchedCount: number;
    completedCount: number;
  };
}

/**
 * Normalize filename for matching:
 * - Remove file extension
 * - Remove trailing (1), (2), etc. brackets
 * - Normalize casing
 */
function normalizeFilename(filename: string): string {
  let result = filename.toLowerCase();
  // Remove file extension
  result = result.replace(/\.[^.]+$/, '');
  // Remove ONLY the last trailing " (number)" suffix
  result = result.replace(/\s*\(\d+\)$/, '');
  // Remove surrounding brackets if present
  result = result.replace(/^\[.*?\]\s*/, '');
  result = result.replace(/^\(.*?\)\s*/, '');
  return result.trim();
}

/**
 * Extract text from PDF using pdf-parse
 */
async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    const data = await pdf(pdfBuffer);
    return data.text || '';
  } catch (err) {
    console.error('PDF extraction error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new Error(`Failed to extract PDF text: ${message}`);
  }
}

/**
 * Classify report type and extract percentage based on keywords in text
 */
function classifyReport(text: string): ClassificationResult {
  const normalizedText = text.toLowerCase().replace(/\s+/g, ' ');
  
  // Check for Similarity Report keywords
  const similarityKeywords = ['overall similarity', 'match groups', 'integrity overview'];
  const isSimilarity = similarityKeywords.some(keyword => normalizedText.includes(keyword));
  
  // Check for AI Report keywords
  const aiKeywords = ['detected as ai', 'ai writing overview', 'detection groups'];
  const isAI = aiKeywords.some(keyword => normalizedText.includes(keyword));
  
  let reportType: 'similarity' | 'ai' | 'unknown' = 'unknown';
  let percentage: number | null = null;
  
  if (isSimilarity && !isAI) {
    reportType = 'similarity';
    // Extract similarity percentage: "X% overall similarity"
    const simMatch = normalizedText.match(/(\d{1,3})\s*%\s*overall similarity/);
    if (simMatch) {
      percentage = parseInt(simMatch[1], 10);
    }
  } else if (isAI && !isSimilarity) {
    reportType = 'ai';
    // Extract AI percentage: "X% detected as ai"
    const aiMatch = normalizedText.match(/(\d{1,3})\s*%\s*detected as ai/);
    if (aiMatch) {
      percentage = parseInt(aiMatch[1], 10);
    }
    // Handle "*% detected as AI" case
    if (normalizedText.includes('*% detected as ai') || normalizedText.includes('*%detected as ai')) {
      percentage = null;
    }
  } else if (isSimilarity && isAI) {
    // If both match, determine by which percentage pattern is found first
    const simMatch = normalizedText.match(/(\d{1,3})\s*%\s*overall similarity/);
    const aiMatch = normalizedText.match(/(\d{1,3})\s*%\s*detected as ai/);
    
    if (simMatch && !aiMatch) {
      reportType = 'similarity';
      percentage = parseInt(simMatch[1], 10);
    } else if (aiMatch && !simMatch) {
      reportType = 'ai';
      percentage = parseInt(aiMatch[1], 10);
    }
  }
  
  return { reportType, percentage, rawText: text.substring(0, 500) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user authentication
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

    // Check if user is admin or staff
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || !["admin", "staff"].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Forbidden - Admin/Staff only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reports } = await req.json() as { reports: ReportFile[] };
    
    if (!reports || !Array.isArray(reports) || reports.length === 0) {
      return new Response(JSON.stringify({ error: "No reports provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${reports.length} reports...`);

    // Fetch all pending/in_progress documents
    const { data: documents, error: docError } = await supabase
      .from("documents")
      .select("id, file_name, normalized_filename, similarity_report_path, ai_report_path, user_id, status")
      .in("status", ["pending", "in_progress"]);

    if (docError) {
      console.error("Error fetching documents:", docError);
      throw new Error("Failed to fetch documents");
    }

    // Create document lookup by normalized filename
    const documentsByNormalized: Record<string, typeof documents[0][]> = {};
    for (const doc of documents || []) {
      const key = doc.normalized_filename || normalizeFilename(doc.file_name);
      if (!documentsByNormalized[key]) {
        documentsByNormalized[key] = [];
      }
      documentsByNormalized[key].push(doc);
    }

    const result: ProcessingResult = {
      success: true,
      mapped: [],
      unmatched: [],
      completedDocuments: [],
      stats: {
        totalReports: reports.length,
        mappedCount: 0,
        unmatchedCount: 0,
        completedCount: 0,
      },
    };

    // Process each report
    for (const report of reports) {
      const normalizedFilename = normalizeFilename(report.fileName);
      console.log(`Processing report: ${report.fileName} -> normalized: ${normalizedFilename}`);

      // Download PDF from storage
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from("reports")
        .download(report.filePath);

      if (downloadError || !pdfData) {
        console.error(`Failed to download ${report.fileName}:`, downloadError);
        result.unmatched.push({
          fileName: report.fileName,
          normalizedFilename,
          filePath: report.filePath,
          reportType: null,
          percentage: null,
        });
        continue;
      }

      // Extract text from page 2 and classify
      let classification: ClassificationResult;
      try {
        const pdfBuffer = await pdfData.arrayBuffer();
        const text = await extractTextFromPDF(pdfBuffer);
        classification = classifyReport(text);
        console.log(`Classified ${report.fileName} as ${classification.reportType} with ${classification.percentage}%`);
      } catch (error) {
        console.error(`PDF extraction failed for ${report.fileName}:`, error);
        classification = { reportType: 'unknown', percentage: null, rawText: '' };
      }

      // Find matching document
      const matchingDocs = documentsByNormalized[normalizedFilename];

      if (!matchingDocs || matchingDocs.length === 0) {
        // No matching document found
        console.log(`No matching document for ${normalizedFilename}`);
        
        // Store as unmatched report
        await supabase.from("unmatched_reports").insert({
          file_name: report.fileName,
          normalized_filename: normalizedFilename,
          file_path: report.filePath,
          report_type: classification.reportType !== 'unknown' ? classification.reportType : null,
          similarity_percentage: classification.reportType === 'similarity' ? classification.percentage : null,
          ai_percentage: classification.reportType === 'ai' ? classification.percentage : null,
          uploaded_by: user.id,
        });

        result.unmatched.push({
          fileName: report.fileName,
          normalizedFilename,
          filePath: report.filePath,
          reportType: classification.reportType !== 'unknown' ? classification.reportType : null,
          percentage: classification.percentage,
        });
        continue;
      }

      // Handle matching document(s)
      if (matchingDocs.length > 1) {
        // Ambiguous match - find the best one
        console.log(`Multiple documents match ${normalizedFilename}, using first available slot`);
      }

      // Try to assign to a document
      let assigned = false;
      for (const doc of matchingDocs) {
        if (classification.reportType === 'similarity' && !doc.similarity_report_path) {
          // Assign as similarity report
          const { error: updateError } = await supabase
            .from("documents")
            .update({
              similarity_report_path: report.filePath,
              similarity_percentage: classification.percentage,
              status: 'in_progress',
            })
            .eq("id", doc.id);

          if (!updateError) {
            doc.similarity_report_path = report.filePath;
            result.mapped.push({
              documentId: doc.id,
              fileName: report.fileName,
              reportType: 'similarity',
              percentage: classification.percentage,
            });
            assigned = true;
            console.log(`Assigned ${report.fileName} as similarity report to ${doc.id}`);
          }
          break;
        } else if (classification.reportType === 'ai' && !doc.ai_report_path) {
          // Assign as AI report
          const { error: updateError } = await supabase
            .from("documents")
            .update({
              ai_report_path: report.filePath,
              ai_percentage: classification.percentage,
              status: 'in_progress',
            })
            .eq("id", doc.id);

          if (!updateError) {
            doc.ai_report_path = report.filePath;
            result.mapped.push({
              documentId: doc.id,
              fileName: report.fileName,
              reportType: 'ai',
              percentage: classification.percentage,
            });
            assigned = true;
            console.log(`Assigned ${report.fileName} as AI report to ${doc.id}`);
          }
          break;
        }
      }

      if (!assigned) {
        // Could not assign - either unknown type or slots already filled
        await supabase.from("unmatched_reports").insert({
          file_name: report.fileName,
          normalized_filename: normalizedFilename,
          file_path: report.filePath,
          report_type: classification.reportType !== 'unknown' ? classification.reportType : null,
          similarity_percentage: classification.reportType === 'similarity' ? classification.percentage : null,
          ai_percentage: classification.reportType === 'ai' ? classification.percentage : null,
          uploaded_by: user.id,
        });

        result.unmatched.push({
          fileName: report.fileName,
          normalizedFilename,
          filePath: report.filePath,
          reportType: classification.reportType !== 'unknown' ? classification.reportType : null,
          percentage: classification.percentage,
        });
      }
    }

    // Check for completed documents and update status
    const processedDocIds = new Set(result.mapped.map(m => m.documentId));
    for (const docId of processedDocIds) {
      const { data: doc } = await supabase
        .from("documents")
        .select("id, similarity_report_path, ai_report_path, user_id")
        .eq("id", docId)
        .single();

      if (doc && doc.similarity_report_path && doc.ai_report_path) {
        // Mark as completed
        await supabase
          .from("documents")
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq("id", docId);

        result.completedDocuments.push(docId);
        console.log(`Document ${docId} completed`);

        // Send notifications
        if (doc.user_id) {
          // Create user notification
          await supabase.from("user_notifications").insert({
            user_id: doc.user_id,
            title: "Document Ready",
            message: "Your document has been processed and reports are now available for download.",
          });

          // Trigger push notification
          try {
            await supabase.functions.invoke("send-push-notification", {
              body: {
                userId: doc.user_id,
                title: "Document Ready",
                body: "Your document has been processed. Reports are ready!",
                eventType: "document_completed",
              },
            });
          } catch (e) {
            console.error("Push notification failed:", e);
          }

          // Send completion email
          try {
            await supabase.functions.invoke("send-completion-email", {
              body: { documentId: docId },
            });
          } catch (e) {
            console.error("Completion email failed:", e);
          }
        }
      }
    }

    // Calculate final stats
    result.stats.mappedCount = result.mapped.length;
    result.stats.unmatchedCount = result.unmatched.length;
    result.stats.completedCount = result.completedDocuments.length;

    console.log(`Processing complete: ${result.stats.mappedCount} mapped, ${result.stats.unmatchedCount} unmatched, ${result.stats.completedCount} completed`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Error processing bulk reports:", err);
    const errorMessage = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
