import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportFile {
  fileName: string;
  filePath: string;
  normalizedFilename: string;
}

interface MappingResult {
  documentId: string;
  fileName: string;
  reportType: 'similarity' | 'ai';
  success: boolean;
  message?: string;
}

interface ProcessingResult {
  success: boolean;
  mapped: MappingResult[];
  unmatched: ReportFile[];
  needsReview: { documentId: string; reason: string }[];
  completedDocuments: string[];
  stats: {
    totalReports: number;
    mappedCount: number;
    unmatchedCount: number;
    completedCount: number;
    needsReviewCount: number;
  };
}

// Normalize filename using the same logic as the database function
function normalizeFilename(filename: string): string {
  let result = filename.toLowerCase();
  // Remove file extension
  result = result.replace(/\.[^.]+$/, '');
  // Remove trailing counters like (1), (2), etc.
  result = result.replace(/\s*\(\d+\)\s*$/, '');
  // Trim whitespace
  return result.trim();
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header to verify staff/admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user role
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is staff or admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || (roleData.role !== 'admin' && roleData.role !== 'staff')) {
      return new Response(JSON.stringify({ error: 'Forbidden - Staff or Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { reports } = await req.json() as { reports: ReportFile[] };

    if (!reports || !Array.isArray(reports) || reports.length === 0) {
      return new Response(JSON.stringify({ error: 'No reports provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${reports.length} reports for auto-mapping`);

    // Fetch all pending and in_progress documents
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, normalized_filename, user_id, similarity_report_path, ai_report_path, status, needs_review')
      .in('status', ['pending', 'in_progress'])
      .eq('needs_review', false);

    if (docError) {
      console.error('Error fetching documents:', docError);
      throw new Error('Failed to fetch documents');
    }

    console.log(`Found ${documents?.length || 0} pending/in_progress documents`);

    // Group reports by normalized filename
    const reportsByNormalized = new Map<string, ReportFile[]>();
    for (const report of reports) {
      const normalized = normalizeFilename(report.fileName);
      report.normalizedFilename = normalized;
      
      if (!reportsByNormalized.has(normalized)) {
        reportsByNormalized.set(normalized, []);
      }
      reportsByNormalized.get(normalized)!.push(report);
    }

    // Group documents by normalized filename
    const docsByNormalized = new Map<string, typeof documents>();
    for (const doc of documents || []) {
      const normalized = doc.normalized_filename || normalizeFilename(doc.file_name);
      
      if (!docsByNormalized.has(normalized)) {
        docsByNormalized.set(normalized, []);
      }
      docsByNormalized.get(normalized)!.push(doc);
    }

    const result: ProcessingResult = {
      success: true,
      mapped: [],
      unmatched: [],
      needsReview: [],
      completedDocuments: [],
      stats: {
        totalReports: reports.length,
        mappedCount: 0,
        unmatchedCount: 0,
        completedCount: 0,
        needsReviewCount: 0,
      },
    };

    // Process each group of reports
    for (const [normalized, matchingReports] of reportsByNormalized) {
      const matchingDocs = docsByNormalized.get(normalized) || [];

      console.log(`Processing normalized filename "${normalized}": ${matchingReports.length} reports, ${matchingDocs.length} matching documents`);

      // Case 1: No matching documents - unmatched reports
      if (matchingDocs.length === 0) {
        for (const report of matchingReports) {
          result.unmatched.push(report);
          
          // Store in unmatched_reports table
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: normalized,
            file_path: report.filePath,
            uploaded_by: user.id,
          });
        }
        continue;
      }

      // Case 2: Multiple documents with same normalized filename - ambiguous, mark for review
      if (matchingDocs.length > 1) {
        for (const doc of matchingDocs) {
          await supabase
            .from('documents')
            .update({
              needs_review: true,
              review_reason: `Multiple documents share the same normalized filename: ${normalized}`,
            })
            .eq('id', doc.id);

          result.needsReview.push({
            documentId: doc.id,
            reason: 'Multiple documents with same normalized filename',
          });
        }
        
        // Add reports to unmatched since we can't determine which document they belong to
        for (const report of matchingReports) {
          result.unmatched.push(report);
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: normalized,
            file_path: report.filePath,
            uploaded_by: user.id,
          });
        }
        continue;
      }

      // Case 3: Exactly one matching document - proceed with mapping
      const doc = matchingDocs[0];
      
      // Case 3a: More than 2 reports for one document - needs review
      if (matchingReports.length > 2) {
        await supabase
          .from('documents')
          .update({
            needs_review: true,
            review_reason: `More than 2 reports matched (${matchingReports.length} found)`,
          })
          .eq('id', doc.id);

        result.needsReview.push({
          documentId: doc.id,
          reason: `More than 2 reports found (${matchingReports.length})`,
        });
        
        // Store excess reports as unmatched
        for (const report of matchingReports) {
          result.unmatched.push(report);
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: normalized,
            file_path: report.filePath,
            uploaded_by: user.id,
          });
        }
        continue;
      }

      // Assign reports: first as similarity, second as AI
      let updatedDoc = { ...doc };
      
      for (let i = 0; i < matchingReports.length; i++) {
        const report = matchingReports[i];
        let reportType: 'similarity' | 'ai';
        
        // Determine which slot to fill
        if (!updatedDoc.similarity_report_path) {
          reportType = 'similarity';
          updatedDoc.similarity_report_path = report.filePath;
        } else if (!updatedDoc.ai_report_path) {
          reportType = 'ai';
          updatedDoc.ai_report_path = report.filePath;
        } else {
          // Both slots filled - this shouldn't happen but handle it
          result.unmatched.push(report);
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: normalized,
            file_path: report.filePath,
            uploaded_by: user.id,
          });
          continue;
        }

        result.mapped.push({
          documentId: doc.id,
          fileName: report.fileName,
          reportType,
          success: true,
        });
        result.stats.mappedCount++;
      }

      // Update the document with new report paths
      const updateData: Record<string, unknown> = {};
      
      if (updatedDoc.similarity_report_path !== doc.similarity_report_path) {
        updateData.similarity_report_path = updatedDoc.similarity_report_path;
      }
      if (updatedDoc.ai_report_path !== doc.ai_report_path) {
        updateData.ai_report_path = updatedDoc.ai_report_path;
      }

      // Check if both reports are now attached - mark as completed
      if (updatedDoc.similarity_report_path && updatedDoc.ai_report_path) {
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
        result.completedDocuments.push(doc.id);
        result.stats.completedCount++;

        console.log(`Document ${doc.id} completed with both reports`);
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('documents')
          .update(updateData)
          .eq('id', doc.id);

        if (updateError) {
          console.error(`Error updating document ${doc.id}:`, updateError);
        }
      }
    }

    // Calculate final stats
    result.stats.unmatchedCount = result.unmatched.length;
    result.stats.needsReviewCount = result.needsReview.length;

    // Send notifications for completed documents
    for (const docId of result.completedDocuments) {
      // Get document details for notification
      const { data: completedDoc } = await supabase
        .from('documents')
        .select('id, file_name, user_id')
        .eq('id', docId)
        .single();

      if (completedDoc?.user_id) {
        // Create user notification
        await supabase.from('user_notifications').insert({
          user_id: completedDoc.user_id,
          title: 'Document Completed',
          message: `Your document "${completedDoc.file_name}" has been processed and is ready for download.`,
          created_by: user.id,
        });

        // Trigger push notification
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              userId: completedDoc.user_id,
              title: 'Document Completed',
              body: `Your document "${completedDoc.file_name}" is ready!`,
              url: '/my-documents',
            }),
          });
        } catch (pushError) {
          console.error('Failed to send push notification:', pushError);
        }

        // Trigger completion email
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-completion-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              documentId: docId,
              userId: completedDoc.user_id,
              fileName: completedDoc.file_name,
            }),
          });
        } catch (emailError) {
          console.error('Failed to send completion email:', emailError);
        }
      }
    }

    console.log('Bulk report processing complete:', result.stats);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in bulk-report-upload:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
