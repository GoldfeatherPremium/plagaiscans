import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReportFile {
  fileName: string;
  storagePath: string;
}

interface ProcessingResult {
  success: boolean;
  totalReports: number;
  mappedCount: number;
  unmatchedCount: number;
  completedDocuments: number;
  needsReviewCount: number;
  errors: string[];
  details: {
    mapped: Array<{ fileName: string; documentId: string; reportType: string; percentage: number | null }>;
    unmatched: Array<{ fileName: string; reason: string }>;
    needsReview: Array<{ fileName: string; documentId: string; reason: string }>;
    completed: Array<{ documentId: string; fileName: string }>;
  };
}

// =====================================================
// STAGE 1: FILENAME NORMALIZATION (must match DB function)
// This mirrors the SQL normalize_filename() function exactly
// =====================================================
function normalizeFilename(filename: string): string {
  let result = filename;
  
  // Remove file extension only - keep all brackets as part of the base name
  result = result.replace(/\.[^.]+$/, "");
  
  // Trim whitespace
  result = result.trim();
  
  // Lowercase for comparison
  result = result.toLowerCase();
  
  return result;
}

// =====================================================
// STAGE 2: DETECT REPORT TYPE FROM FILENAME
// Since PDF parsing doesn't work in Deno, detect from filename
// =====================================================
function detectReportTypeFromFilename(filename: string): "similarity" | "ai" | "unknown" {
  const lowerName = filename.toLowerCase();
  
  // Check for AI report indicators in filename
  if (lowerName.includes("ai") || lowerName.includes("_ai") || lowerName.includes("-ai") || lowerName.includes(" ai")) {
    return "ai";
  }
  
  // Check for similarity report indicators
  if (lowerName.includes("similarity") || lowerName.includes("sim") || lowerName.includes("turnitin") || lowerName.includes("plag")) {
    return "similarity";
  }
  
  // Default to similarity for reports without clear indicators
  // Most bulk uploads are similarity reports
  return "similarity";
}

// =====================================================
// MAIN HANDLER
// =====================================================
serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== STARTING BULK REPORT PROCESSING ===");
    
    // Initialize Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user using the anon key client
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      throw new Error("No bearer token");
    }

    // Create client with anon key and validate the passed JWT explicitly
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      throw new Error("Authentication failed");
    }

    console.log(`User authenticated: ${user.id}`);

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || !["admin", "staff"].includes(roleData.role)) {
      throw new Error("Unauthorized: Admin or staff role required");
    }

    console.log(`User ${user.id} (${roleData.role}) authenticated`);

    // Parse request body
    const { reports }: { reports: ReportFile[] } = await req.json();
    
    if (!reports || !Array.isArray(reports) || reports.length === 0) {
      throw new Error("No reports provided");
    }

    console.log(`Processing ${reports.length} reports...`);

    // Initialize result
    const result: ProcessingResult = {
      success: true,
      totalReports: reports.length,
      mappedCount: 0,
      unmatchedCount: 0,
      completedDocuments: 0,
      needsReviewCount: 0,
      errors: [],
      details: {
        mapped: [],
        unmatched: [],
        needsReview: [],
        completed: []
      }
    };

    // =====================================================
    // FETCH ALL PENDING/IN-PROGRESS DOCUMENTS
    // =====================================================
    const { data: documents, error: docError } = await supabase
      .from("documents")
      .select("id, file_name, normalized_filename, similarity_report_path, ai_report_path, similarity_percentage, ai_percentage, status, user_id")
      .in("status", ["pending", "in_progress"]);

    if (docError) {
      throw new Error(`Failed to fetch documents: ${docError.message}`);
    }

    console.log(`Found ${documents?.length || 0} pending/in-progress documents`);

    // Build document lookup by normalized filename
    const documentsByNormalizedName = new Map<string, typeof documents[0][]>();
    for (const doc of documents || []) {
      const normalized = doc.normalized_filename || normalizeFilename(doc.file_name);
      const existing = documentsByNormalizedName.get(normalized) || [];
      existing.push(doc);
      documentsByNormalizedName.set(normalized, existing);
    }

    // =====================================================
    // PROCESS EACH REPORT
    // =====================================================
    for (const report of reports) {
      console.log(`\n--- Processing: ${report.fileName} ---`);
      
      try {
        // STAGE 1: Normalize filename for grouping
        const normalizedName = normalizeFilename(report.fileName);
        console.log(`Normalized filename: "${normalizedName}"`);

        // Find matching documents
        const matchingDocs = documentsByNormalizedName.get(normalizedName) || [];
        
        if (matchingDocs.length === 0) {
          console.log(`No matching document found for: ${report.fileName}`);
          
          // Save to unmatched_reports
          await supabase.from("unmatched_reports").insert({
            file_name: report.fileName,
            normalized_filename: normalizedName,
            file_path: report.storagePath,
            report_type: null,
            uploaded_by: user.id,
            resolved: false
          });
          
          result.unmatchedCount++;
          result.details.unmatched.push({
            fileName: report.fileName,
            reason: "No matching document found"
          });
          continue;
        }

        // Handle multiple matching documents
        if (matchingDocs.length > 1) {
          console.log(`Multiple documents (${matchingDocs.length}) match this filename - needs review`);
          
          // Mark all matching documents for review
          for (const doc of matchingDocs) {
            await supabase
              .from("documents")
              .update({
                needs_review: true,
                review_reason: `Multiple documents match filename: ${report.fileName}`
              })
              .eq("id", doc.id);
          }
          
          result.needsReviewCount++;
          result.details.needsReview.push({
            fileName: report.fileName,
            documentId: matchingDocs[0].id,
            reason: "Multiple documents match this filename"
          });
          continue;
        }

        const matchedDoc = matchingDocs[0];
        console.log(`Matched to document: ${matchedDoc.id}`);

        // STAGE 2: Detect report type from filename (PDF parsing not available in Deno)
        const reportType = detectReportTypeFromFilename(report.fileName);
        console.log(`Report type detected from filename: ${reportType}`);
        
        // Note: percentage extraction requires PDF parsing which isn't available
        // Percentages will need to be entered manually or via a different mechanism
        const percentage: number | null = null;

        // =====================================================
        // STAGE 3: DRY RUN VALIDATION
        // =====================================================
        const updateData: Record<string, any> = {};
        let canUpdate = true;
        let reviewReason = "";

        if (reportType === "similarity") {
          // Check if similarity report already exists
          if (matchedDoc.similarity_report_path) {
            console.log("Document already has a similarity report - marking for review");
            canUpdate = false;
            reviewReason = "Document already has a similarity report attached";
          } else {
            updateData.similarity_report_path = report.storagePath;
            if (percentage !== null) {
              updateData.similarity_percentage = percentage;
            }
          }
        } else if (reportType === "ai") {
          // Check if AI report already exists
          if (matchedDoc.ai_report_path) {
            console.log("Document already has an AI report - marking for review");
            canUpdate = false;
            reviewReason = "Document already has an AI report attached";
          } else {
            updateData.ai_report_path = report.storagePath;
            if (percentage !== null) {
              updateData.ai_percentage = percentage;
            }
          }
        }

        if (!canUpdate) {
          await supabase
            .from("documents")
            .update({
              needs_review: true,
              review_reason: reviewReason
            })
            .eq("id", matchedDoc.id);
          
          result.needsReviewCount++;
          result.details.needsReview.push({
            fileName: report.fileName,
            documentId: matchedDoc.id,
            reason: reviewReason
          });
          continue;
        }

        // =====================================================
        // STAGE 4: COMMIT - Update document
        // =====================================================
        const { error: updateError } = await supabase
          .from("documents")
          .update(updateData)
          .eq("id", matchedDoc.id);

        if (updateError) {
          throw new Error(`Failed to update document: ${updateError.message}`);
        }

        console.log(`Successfully attached ${reportType} report to document ${matchedDoc.id}`);
        
        result.mappedCount++;
        result.details.mapped.push({
          fileName: report.fileName,
          documentId: matchedDoc.id,
          reportType: reportType,
          percentage: percentage
        });

        // Update local cache for subsequent reports
        if (reportType === "similarity") {
          matchedDoc.similarity_report_path = report.storagePath;
          if (percentage !== null) {
            matchedDoc.similarity_percentage = percentage;
          }
        } else {
          matchedDoc.ai_report_path = report.storagePath;
          if (percentage !== null) {
            matchedDoc.ai_percentage = percentage;
          }
        }

        // =====================================================
        // STAGE 7: AUTO-COMPLETE CHECK
        // =====================================================
        // Check if document now has both reports
        if (matchedDoc.similarity_report_path && matchedDoc.ai_report_path) {
          console.log(`Document ${matchedDoc.id} now has both reports - marking as completed`);
          
          const { error: completeError } = await supabase
            .from("documents")
            .update({
              status: "completed",
              completed_at: new Date().toISOString()
            })
            .eq("id", matchedDoc.id);

          if (!completeError) {
            result.completedDocuments++;
            result.details.completed.push({
              documentId: matchedDoc.id,
              fileName: matchedDoc.file_name
            });

            // Send notifications for completed documents
            try {
              // Send push notification
              await supabase.functions.invoke("send-push-notification", {
                body: {
                  userId: matchedDoc.user_id,
                  title: "Document Ready! 📄",
                  body: `Your document "${matchedDoc.file_name}" has been processed and is ready for download.`,
                  eventType: "document_completion"
                }
              });

              // Send completion email
              await supabase.functions.invoke("send-completion-email", {
                body: {
                  userId: matchedDoc.user_id,
                  documentId: matchedDoc.id,
                  fileName: matchedDoc.file_name
                }
              });

              console.log(`Notifications sent for document ${matchedDoc.id}`);
            } catch (notifError) {
              console.error("Failed to send notifications:", notifError);
              // Don't fail the whole process for notification errors
            }
          }
        }

      } catch (reportError: unknown) {
        console.error(`Error processing ${report.fileName}:`, reportError);
        const errorMessage = reportError instanceof Error ? reportError.message : String(reportError);
        result.errors.push(`${report.fileName}: ${errorMessage}`);
        
        // Save to unmatched for manual review
        await supabase.from("unmatched_reports").insert({
          file_name: report.fileName,
          normalized_filename: normalizeFilename(report.fileName),
          file_path: report.storagePath,
          report_type: "error",
          uploaded_by: user.id,
          resolved: false
        });
        
        result.unmatchedCount++;
        result.details.unmatched.push({
          fileName: report.fileName,
          reason: `Processing error: ${errorMessage}`
        });
      }
    }

    console.log("\n=== BULK PROCESSING COMPLETE ===");
    console.log(`Mapped: ${result.mappedCount}, Unmatched: ${result.unmatchedCount}, Completed: ${result.completedDocuments}, Needs Review: ${result.needsReviewCount}`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Bulk report processing failed:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        totalReports: 0,
        mappedCount: 0,
        unmatchedCount: 0,
        completedDocuments: 0,
        needsReviewCount: 0,
        errors: [error.message],
        details: { mapped: [], unmatched: [], needsReview: [], completed: [] }
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
