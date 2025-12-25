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
  reportType: 'similarity' | 'ai' | 'unknown';
  success: boolean;
  message?: string;
  percentage?: number | null;
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

interface OCRClassification {
  reportType: 'similarity' | 'ai' | 'unknown';
  percentage: number | null;
  rawText: string;
}

/**
 * STAGE 1 - Normalize filename for GROUPING only.
 * - Remove file extension
 * - Remove trailing numbers like (1), (2), (45)
 * - Remove surrounding brackets () or []
 * - Normalize spaces and casing
 * 
 * Examples:
 *   "(Reflective Writing).pdf" → "reflective writing"
 *   "TOKPD (11).pdf" → "tokpd"
 *   "[Guest] Document (45).docx" → "guest document"
 *   "fileA1 (1).pdf" → "filea1"
 */
function normalizeFilename(filename: string): string {
  let result = filename.toLowerCase();
  
  // Remove file extension
  result = result.replace(/\.[^.]+$/, '');
  
  // Remove trailing " (number)" patterns repeatedly
  while (/\s*\(\d+\)\s*$/.test(result)) {
    result = result.replace(/\s*\(\d+\)\s*$/, '');
  }
  
  // Remove surrounding brackets at start: [text] or (text)
  result = result.replace(/^\[([^\]]+)\]\s*/, '$1 ');
  result = result.replace(/^\(([^)]+)\)\s*/, '$1 ');
  
  // Collapse multiple spaces
  result = result.replace(/\s+/g, ' ');
  
  return result.trim();
}

/**
 * STAGE 2 - OCR-based report classification
 * Uses OCR.space API to extract text from page 2 of PDF
 */
async function classifyReportWithOCR(
  supabase: any,
  filePath: string,
  ocrApiKey: string
): Promise<OCRClassification> {
  console.log(`[OCR] Starting classification for: ${filePath}`);
  
  try {
    // Download the PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('reports')
      .download(filePath);
    
    if (downloadError || !fileData) {
      console.error(`[OCR] Failed to download file: ${downloadError?.message}`);
      return { reportType: 'unknown', percentage: null, rawText: '' };
    }

    // Convert blob to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    // Call OCR.space API with page 2
    const formData = new FormData();
    formData.append('base64Image', `data:application/pdf;base64,${base64}`);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('filetype', 'PDF');
    formData.append('OCREngine', '2'); // More accurate engine
    formData.append('isTable', 'true');
    formData.append('scale', 'true');
    // Request only page 2 for classification
    formData.append('pageNumber', '2');

    console.log(`[OCR] Calling OCR.space API for page 2...`);
    
    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'apikey': ocrApiKey,
      },
      body: formData,
    });

    if (!ocrResponse.ok) {
      console.error(`[OCR] API request failed: ${ocrResponse.status}`);
      return { reportType: 'unknown', percentage: null, rawText: '' };
    }

    const ocrResult = await ocrResponse.json();
    
    if (ocrResult.IsErroredOnProcessing || !ocrResult.ParsedResults?.[0]?.ParsedText) {
      console.error(`[OCR] Processing error:`, ocrResult.ErrorMessage || 'No text found');
      return { reportType: 'unknown', percentage: null, rawText: '' };
    }

    const rawText = ocrResult.ParsedResults[0].ParsedText;
    console.log(`[OCR] Extracted text length: ${rawText.length} characters`);
    
    // Normalize OCR text for matching
    const normalizedText = rawText.toLowerCase().replace(/\s+/g, ' ');
    
    // REPORT TYPE DETECTION (STRICT)
    let reportType: 'similarity' | 'ai' | 'unknown' = 'unknown';
    let percentage: number | null = null;

    // Check for Similarity Report indicators
    const similarityIndicators = [
      'overall similarity',
      'match groups',
      'integrity overview'
    ];
    
    // Check for AI Report indicators
    const aiIndicators = [
      'detected as ai',
      'ai writing overview',
      'detection groups'
    ];

    const isSimilarity = similarityIndicators.some(indicator => 
      normalizedText.includes(indicator)
    );
    
    const isAI = aiIndicators.some(indicator => 
      normalizedText.includes(indicator)
    );

    console.log(`[OCR] Detection - Similarity indicators: ${isSimilarity}, AI indicators: ${isAI}`);

    if (isSimilarity && !isAI) {
      reportType = 'similarity';
      // Extract similarity percentage: (\d{1,3})\s*%\s*overall similarity
      const similarityMatch = normalizedText.match(/(\d{1,3})\s*%\s*overall similarity/);
      if (similarityMatch) {
        percentage = parseInt(similarityMatch[1], 10);
        console.log(`[OCR] Extracted similarity percentage: ${percentage}%`);
      }
    } else if (isAI && !isSimilarity) {
      reportType = 'ai';
      // Extract AI percentage: (\d{1,3})\s*%\s*detected as ai
      // Handle "*% detected as AI" case
      const aiMatch = normalizedText.match(/(\d{1,3}|\*)\s*%\s*detected as ai/);
      if (aiMatch) {
        if (aiMatch[1] === '*') {
          percentage = null; // Asterisk means no percentage available
          console.log(`[OCR] AI percentage shows asterisk - setting to NULL`);
        } else {
          percentage = parseInt(aiMatch[1], 10);
          console.log(`[OCR] Extracted AI percentage: ${percentage}%`);
        }
      }
    } else if (isSimilarity && isAI) {
      // Both indicators found - needs manual review
      console.log(`[OCR] Both similarity and AI indicators found - marking as unknown`);
      reportType = 'unknown';
    }

    console.log(`[OCR] Final classification: ${reportType}, percentage: ${percentage}`);
    
    return { reportType, percentage, rawText: normalizedText.substring(0, 500) };
    
  } catch (error) {
    console.error(`[OCR] Classification error:`, error);
    return { reportType: 'unknown', percentage: null, rawText: '' };
  }
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ocrApiKey = Deno.env.get('OCR_SPACE_API_KEY');
    
    if (!ocrApiKey) {
      console.error('OCR_SPACE_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'OCR service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
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

    console.log(`[BULK] Processing ${reports.length} reports for auto-mapping with OCR classification`);

    // Fetch all pending and in_progress documents
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, normalized_filename, user_id, similarity_report_path, ai_report_path, similarity_percentage, ai_percentage, status, needs_review')
      .in('status', ['pending', 'in_progress'])
      .eq('needs_review', false);

    if (docError) {
      console.error('[BULK] Error fetching documents:', docError);
      throw new Error('Failed to fetch documents');
    }

    console.log(`[BULK] Found ${documents?.length || 0} pending/in_progress documents`);

    // STAGE 1: Group documents by normalized filename
    const docsByNormalized = new Map<string, typeof documents>();
    for (const doc of documents || []) {
      const normalized = doc.normalized_filename || normalizeFilename(doc.file_name);
      
      if (!docsByNormalized.has(normalized)) {
        docsByNormalized.set(normalized, []);
      }
      docsByNormalized.get(normalized)!.push(doc);
    }

    console.log(`[BULK] Document groups:`, Array.from(docsByNormalized.keys()));

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

    // Process each report individually with OCR classification
    for (const report of reports) {
      console.log(`\n[BULK] Processing report: ${report.fileName}`);
      
      // Normalize report filename for matching
      const normalizedReportName = normalizeFilename(report.fileName);
      report.normalizedFilename = normalizedReportName;
      
      console.log(`[BULK] Normalized report name: ${normalizedReportName}`);
      
      // Find matching documents
      const matchingDocs = docsByNormalized.get(normalizedReportName) || [];
      
      // Case 1: No matching documents
      if (matchingDocs.length === 0) {
        console.log(`[BULK] No matching document found for: ${normalizedReportName}`);
        result.unmatched.push(report);
        
        // Run OCR to determine report type for unmatched reports
        const classification = await classifyReportWithOCR(supabase, report.filePath, ocrApiKey);
        
        // Store in unmatched_reports table with classification info
        await supabase.from('unmatched_reports').insert({
          file_name: report.fileName,
          normalized_filename: normalizedReportName,
          file_path: report.filePath,
          report_type: classification.reportType,
          similarity_percentage: classification.reportType === 'similarity' ? classification.percentage : null,
          ai_percentage: classification.reportType === 'ai' ? classification.percentage : null,
          uploaded_by: user.id,
        });
        continue;
      }

      // Case 2: Multiple documents with same normalized filename - ambiguous
      if (matchingDocs.length > 1) {
        console.log(`[BULK] Multiple documents match: ${normalizedReportName} (${matchingDocs.length} docs)`);
        
        for (const doc of matchingDocs) {
          await supabase
            .from('documents')
            .update({
              needs_review: true,
              review_reason: `Multiple documents share the same normalized filename: ${normalizedReportName}`,
            })
            .eq('id', doc.id);

          result.needsReview.push({
            documentId: doc.id,
            reason: 'Multiple documents with same normalized filename',
          });
        }
        
        // Store report as unmatched
        result.unmatched.push(report);
        await supabase.from('unmatched_reports').insert({
          file_name: report.fileName,
          normalized_filename: normalizedReportName,
          file_path: report.filePath,
          uploaded_by: user.id,
        });
        continue;
      }

      // Case 3: Exactly one matching document
      const doc = matchingDocs[0];
      console.log(`[BULK] Found matching document: ${doc.id} (${doc.file_name})`);

      // STAGE 2: OCR-based classification
      const classification = await classifyReportWithOCR(supabase, report.filePath, ocrApiKey);
      console.log(`[BULK] OCR Classification: ${classification.reportType}, percentage: ${classification.percentage}`);

      // Handle classification result
      if (classification.reportType === 'unknown') {
        console.log(`[BULK] Could not classify report - marking for review`);
        
        await supabase
          .from('documents')
          .update({
            needs_review: true,
            review_reason: 'Report classification failed - could not determine if Similarity or AI report',
          })
          .eq('id', doc.id);

        result.needsReview.push({
          documentId: doc.id,
          reason: 'Report classification failed',
        });

        result.mapped.push({
          documentId: doc.id,
          fileName: report.fileName,
          reportType: 'unknown',
          success: false,
          message: 'OCR classification failed',
        });
        continue;
      }

      // Check if the slot is already filled
      if (classification.reportType === 'similarity' && doc.similarity_report_path) {
        console.log(`[BULK] Similarity report already exists for document`);
        result.unmatched.push(report);
        await supabase.from('unmatched_reports').insert({
          file_name: report.fileName,
          normalized_filename: normalizedReportName,
          file_path: report.filePath,
          report_type: 'similarity',
          similarity_percentage: classification.percentage,
          matched_document_id: doc.id,
          uploaded_by: user.id,
        });
        continue;
      }

      if (classification.reportType === 'ai' && doc.ai_report_path) {
        console.log(`[BULK] AI report already exists for document`);
        result.unmatched.push(report);
        await supabase.from('unmatched_reports').insert({
          file_name: report.fileName,
          normalized_filename: normalizedReportName,
          file_path: report.filePath,
          report_type: 'ai',
          ai_percentage: classification.percentage,
          matched_document_id: doc.id,
          uploaded_by: user.id,
        });
        continue;
      }

      // Update document with the classified report
      const updateData: Record<string, unknown> = {};

      if (classification.reportType === 'similarity') {
        updateData.similarity_report_path = report.filePath;
        updateData.similarity_percentage = classification.percentage;
        console.log(`[BULK] Assigning as SIMILARITY report, percentage: ${classification.percentage}%`);
      } else if (classification.reportType === 'ai') {
        updateData.ai_report_path = report.filePath;
        updateData.ai_percentage = classification.percentage;
        console.log(`[BULK] Assigning as AI report, percentage: ${classification.percentage}`);
      }

      // Check if both reports will now exist
      const willHaveBothReports = 
        (classification.reportType === 'similarity' && doc.ai_report_path) ||
        (classification.reportType === 'ai' && doc.similarity_report_path);

      if (willHaveBothReports) {
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
        result.completedDocuments.push(doc.id);
        result.stats.completedCount++;
        console.log(`[BULK] Document ${doc.id} is now COMPLETED with both reports`);
      }

      // Apply update
      const { error: updateError } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', doc.id);

      if (updateError) {
        console.error(`[BULK] Error updating document ${doc.id}:`, updateError);
        result.mapped.push({
          documentId: doc.id,
          fileName: report.fileName,
          reportType: classification.reportType,
          success: false,
          message: updateError.message,
        });
      } else {
        result.mapped.push({
          documentId: doc.id,
          fileName: report.fileName,
          reportType: classification.reportType,
          success: true,
          percentage: classification.percentage,
        });
        result.stats.mappedCount++;
      }
    }

    // Calculate final stats
    result.stats.unmatchedCount = result.unmatched.length;
    result.stats.needsReviewCount = result.needsReview.length;

    // Send notifications for completed documents
    for (const docId of result.completedDocuments) {
      const { data: completedDoc } = await supabase
        .from('documents')
        .select('id, file_name, user_id')
        .eq('id', docId)
        .single();

      if (completedDoc?.user_id) {
        // Create user notification
        await supabase.from('user_notifications').insert({
          user_id: completedDoc.user_id,
          title: 'Document Completed ✓',
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
          console.error('[BULK] Failed to send push notification:', pushError);
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
          console.error('[BULK] Failed to send completion email:', emailError);
        }
      }
    }

    console.log('\n[BULK] Processing complete:', result.stats);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[BULK] Error in bulk-report-upload:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
