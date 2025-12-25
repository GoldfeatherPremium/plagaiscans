import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportFile {
  fileName: string;
  filePath: string;
}

interface ClassifiedReport {
  fileName: string;
  filePath: string;
  documentKey: string;
  reportType: 'similarity' | 'ai' | 'unknown' | 'unreadable';
  percentage: number | null;
  ocrStatus: 'success' | 'failed' | 'no_text';
}

interface MappingResult {
  documentId: string;
  fileName: string;
  reportType: 'similarity' | 'ai' | 'unknown' | 'unreadable';
  percentage: number | null;
  success: boolean;
  message?: string;
}

interface ProcessingResult {
  success: boolean;
  mapped: MappingResult[];
  unmatched: { fileName: string; documentKey: string; filePath: string; reportType: string }[];
  needsReview: { documentId: string; reason: string }[];
  completedDocuments: string[];
  stats: {
    totalReports: number;
    mappedCount: number;
    unmatchedCount: number;
    completedCount: number;
    needsReviewCount: number;
    classifiedAsSimilarity: number;
    classifiedAsAI: number;
    classifiedAsUnknown: number;
    classifiedAsUnreadable: number;
  };
}

/**
 * STAGE 1: Extract document_key from filename
 * 
 * Rules:
 * 1. Remove file extension
 * 2. Remove trailing numbers in round brackets: (1), (2), (45)
 * 3. Remove surrounding brackets if present: (), []
 * 4. Normalize casing and spaces
 * 
 * Examples:
 * - "(Reflective Writing).pdf" → "reflective writing"
 * - "TOKPD (11).pdf" → "tokpd"
 * - "[Guest] Document (45).docx" → "guest document"
 * - "SWOT,TOWS,AHP ASSIGNMENT(1).pdf" → "swot,tows,ahp assignment"
 */
function extractDocumentKey(filename: string): string {
  let result = filename;
  
  // Step 1: Remove file extension
  result = result.replace(/\.[^.]+$/, '');
  
  // Step 2: Remove ALL trailing "(number)" patterns - keep removing until none left
  while (/\s*\(\d+\)\s*$/.test(result)) {
    result = result.replace(/\s*\(\d+\)\s*$/, '');
  }
  
  // Step 3: Remove leading/trailing brackets [] or ()
  result = result.replace(/^\[([^\]]*)\]$/, '$1');
  result = result.replace(/^\(([^)]*)\)$/, '$1');
  
  // Also handle [Guest] prefix
  result = result.replace(/^\[Guest\]\s*/i, '');
  
  // Step 4: Normalize - lowercase and collapse multiple spaces
  result = result.toLowerCase();
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

/**
 * STAGE 2: Perform OCR on PDF page 2 using OCR.space API
 * 
 * Returns OCR text from page 2 of the PDF
 * OCR.space API is used as it supports direct PDF input
 */
async function performOCROnPDF(
  pdfBuffer: ArrayBuffer,
  ocrApiKey: string
): Promise<{ success: boolean; text: string; error?: string }> {
  try {
    // Convert to base64
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
    
    // OCR.space API call with PDF file
    // Using filetype=PDF and specifying page 2
    const formData = new FormData();
    formData.append('base64Image', `data:application/pdf;base64,${base64Pdf}`);
    formData.append('apikey', ocrApiKey);
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('filetype', 'PDF');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2'); // Engine 2 is better for text-heavy documents
    
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      console.error('OCR.space API error:', response.status, await response.text());
      return { success: false, text: '', error: 'OCR API request failed' };
    }

    const result = await response.json();
    console.log('OCR.space response:', JSON.stringify(result).slice(0, 500));

    if (result.IsErroredOnProcessing) {
      console.error('OCR.space processing error:', result.ErrorMessage);
      return { success: false, text: '', error: result.ErrorMessage?.[0] || 'OCR processing failed' };
    }

    // OCR.space returns parsed text for each page
    // We need page 2 (index 1)
    const parsedResults = result.ParsedResults || [];
    
    if (parsedResults.length === 0) {
      return { success: false, text: '', error: 'No pages parsed' };
    }

    // Get page 2 if available, otherwise use page 1
    const pageIndex = parsedResults.length > 1 ? 1 : 0;
    const pageText = parsedResults[pageIndex]?.ParsedText || '';
    
    if (!pageText || pageText.trim().length < 10) {
      return { success: true, text: '', error: 'No usable text found' };
    }

    // Normalize: lowercase and collapse spaces
    const normalizedText = pageText.toLowerCase().replace(/\s+/g, ' ').trim();
    
    return { success: true, text: normalizedText };

  } catch (error) {
    console.error('OCR error:', error);
    return { success: false, text: '', error: String(error) };
  }
}

/**
 * STAGE 3: Classify report type based on OCR text
 * 
 * STRICT RULES:
 * - Similarity Report: "overall similarity", "match groups", "integrity overview"
 * - AI Report: "detected as ai", "ai writing overview", "detection groups"
 */
function classifyReportFromText(text: string): 'similarity' | 'ai' | 'unknown' {
  const normalizedText = text.toLowerCase();
  
  // Check for Similarity Report indicators
  const similarityIndicators = [
    'overall similarity',
    'match groups',
    'integrity overview'
  ];
  
  for (const indicator of similarityIndicators) {
    if (normalizedText.includes(indicator)) {
      console.log(`Found similarity indicator: "${indicator}"`);
      return 'similarity';
    }
  }
  
  // Check for AI Report indicators
  const aiIndicators = [
    'detected as ai',
    'ai writing overview',
    'detection groups'
  ];
  
  for (const indicator of aiIndicators) {
    if (normalizedText.includes(indicator)) {
      console.log(`Found AI indicator: "${indicator}"`);
      return 'ai';
    }
  }
  
  return 'unknown';
}

/**
 * STAGE 4: Extract percentage from OCR text
 * 
 * Similarity: (\d{1,3})\s*%\s*overall similarity
 * AI: (\d{1,3})\s*%\s*detected as ai
 * Special case: *% detected as AI → null
 */
function extractPercentage(text: string, reportType: 'similarity' | 'ai'): number | null {
  const normalizedText = text.toLowerCase();
  
  if (reportType === 'similarity') {
    // Match: X% overall similarity (with flexible spacing)
    const match = normalizedText.match(/(\d{1,3})\s*%\s*overall\s*similarity/);
    if (match) {
      return parseInt(match[1], 10);
    }
  } else if (reportType === 'ai') {
    // Check for asterisk case first
    if (normalizedText.includes('*%') && normalizedText.includes('detected as ai')) {
      return null;
    }
    // Match: X% detected as ai (with flexible spacing)
    const match = normalizedText.match(/(\d{1,3})\s*%\s*detected\s*as\s*ai/);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  return null;
}

/**
 * Full classification pipeline using OCR only
 */
async function classifyReportWithOCR(
  supabase: any,
  filePath: string,
  ocrApiKey: string
): Promise<{ 
  reportType: 'similarity' | 'ai' | 'unknown' | 'unreadable'; 
  percentage: number | null;
  ocrStatus: 'success' | 'failed' | 'no_text';
}> {
  try {
    // Download the PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('reports')
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('Failed to download PDF:', downloadError);
      return { reportType: 'unreadable', percentage: null, ocrStatus: 'failed' };
    }

    // Get PDF as ArrayBuffer
    const pdfBuffer = await fileData.arrayBuffer();
    
    // Perform OCR
    console.log(`Performing OCR on: ${filePath}`);
    const ocrResult = await performOCROnPDF(pdfBuffer, ocrApiKey);
    
    if (!ocrResult.success) {
      console.error('OCR failed:', ocrResult.error);
      return { reportType: 'unreadable', percentage: null, ocrStatus: 'failed' };
    }
    
    if (!ocrResult.text || ocrResult.text.length < 10) {
      console.log('No usable OCR text extracted');
      return { reportType: 'unreadable', percentage: null, ocrStatus: 'no_text' };
    }
    
    console.log(`OCR text (first 500 chars): ${ocrResult.text.slice(0, 500)}`);
    
    // Classify based on OCR text
    const reportType = classifyReportFromText(ocrResult.text);
    
    // Extract percentage if classified
    let percentage: number | null = null;
    if (reportType === 'similarity' || reportType === 'ai') {
      percentage = extractPercentage(ocrResult.text, reportType);
    }
    
    console.log(`Classification result: ${reportType}, percentage: ${percentage}`);
    
    return { reportType, percentage, ocrStatus: 'success' };

  } catch (error) {
    console.error('Error in OCR classification:', error);
    return { reportType: 'unreadable', percentage: null, ocrStatus: 'failed' };
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check OCR API key
    if (!ocrApiKey) {
      console.error('OCR_SPACE_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'OCR API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    console.log(`Processing ${reports.length} reports with OCR-based classification`);

    // Fetch all pending and in_progress documents
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, user_id, similarity_report_path, ai_report_path, similarity_percentage, ai_percentage, status, needs_review')
      .in('status', ['pending', 'in_progress'])
      .eq('needs_review', false);

    if (docError) {
      console.error('Error fetching documents:', docError);
      throw new Error('Failed to fetch documents');
    }

    console.log(`Found ${documents?.length || 0} pending/in_progress documents`);

    // ============= STAGE 1: DOCUMENT GROUPING =============
    // Build document_key index for customer documents
    const docsByKey = new Map<string, typeof documents>();
    for (const doc of documents || []) {
      const docKey = extractDocumentKey(doc.file_name);
      console.log(`Document "${doc.file_name}" → document_key: "${docKey}"`);
      
      if (!docsByKey.has(docKey)) {
        docsByKey.set(docKey, []);
      }
      docsByKey.get(docKey)!.push(doc);
    }

    console.log(`Document keys:`, Array.from(docsByKey.keys()));

    // Extract document_key for each report and group them
    const reportsByKey = new Map<string, ReportFile[]>();
    for (const report of reports) {
      const docKey = extractDocumentKey(report.fileName);
      console.log(`Report "${report.fileName}" → document_key: "${docKey}"`);
      
      if (!reportsByKey.has(docKey)) {
        reportsByKey.set(docKey, []);
      }
      reportsByKey.get(docKey)!.push(report);
    }

    console.log(`Report keys:`, Array.from(reportsByKey.keys()));

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
        classifiedAsSimilarity: 0,
        classifiedAsAI: 0,
        classifiedAsUnknown: 0,
        classifiedAsUnreadable: 0,
      },
    };

    // ============= STAGE 2 & 3: OCR + CLASSIFICATION =============
    // Process each group of reports
    for (const [docKey, matchingReports] of reportsByKey) {
      const matchingDocs = docsByKey.get(docKey) || [];

      console.log(`Processing document_key "${docKey}": ${matchingReports.length} reports, ${matchingDocs.length} matching documents`);

      // Case 1: No matching documents - unmatched reports
      if (matchingDocs.length === 0) {
        for (const report of matchingReports) {
          // Still classify the report for logging
          const classification = await classifyReportWithOCR(supabase, report.filePath, ocrApiKey);
          
          result.unmatched.push({
            fileName: report.fileName,
            documentKey: docKey,
            filePath: report.filePath,
            reportType: classification.reportType,
          });
          
          // Update stats
          if (classification.reportType === 'similarity') result.stats.classifiedAsSimilarity++;
          else if (classification.reportType === 'ai') result.stats.classifiedAsAI++;
          else if (classification.reportType === 'unreadable') result.stats.classifiedAsUnreadable++;
          else result.stats.classifiedAsUnknown++;
          
          // Store in unmatched_reports table with extracted percentages
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: docKey,
            file_path: report.filePath,
            report_type: classification.reportType,
            similarity_percentage: classification.reportType === 'similarity' ? classification.percentage : null,
            ai_percentage: classification.reportType === 'ai' ? classification.percentage : null,
            uploaded_by: user.id,
          });
        }
        result.stats.unmatchedCount += matchingReports.length;
        continue;
      }

      // Case 2: Multiple documents with same document_key - ambiguous, mark for review
      if (matchingDocs.length > 1) {
        for (const doc of matchingDocs) {
          await supabase
            .from('documents')
            .update({
              needs_review: true,
              review_reason: `Multiple documents share the same document_key: ${docKey}`,
            })
            .eq('id', doc.id);

          result.needsReview.push({
            documentId: doc.id,
            reason: 'Multiple documents with same document_key',
          });
          result.stats.needsReviewCount++;
        }
        
        // Add reports to unmatched
        for (const report of matchingReports) {
          result.unmatched.push({
            fileName: report.fileName,
            documentKey: docKey,
            filePath: report.filePath,
            reportType: 'unknown',
          });
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: docKey,
            file_path: report.filePath,
            report_type: 'unknown',
            uploaded_by: user.id,
          });
        }
        result.stats.unmatchedCount += matchingReports.length;
        continue;
      }

      // Case 3: Exactly one matching document - classify and attach reports
      const doc = matchingDocs[0];
      
      // Classify each report using OCR
      const classifiedReports: ClassifiedReport[] = [];
      
      for (const report of matchingReports) {
        console.log(`Classifying report: ${report.fileName}`);
        const classification = await classifyReportWithOCR(supabase, report.filePath, ocrApiKey);
        
        classifiedReports.push({
          ...report,
          documentKey: docKey,
          reportType: classification.reportType,
          percentage: classification.percentage,
          ocrStatus: classification.ocrStatus,
        });

        console.log(`Report "${report.fileName}" classified as: ${classification.reportType} (${classification.percentage}%)`);

        // Update stats
        if (classification.reportType === 'similarity') result.stats.classifiedAsSimilarity++;
        else if (classification.reportType === 'ai') result.stats.classifiedAsAI++;
        else if (classification.reportType === 'unreadable') result.stats.classifiedAsUnreadable++;
        else result.stats.classifiedAsUnknown++;
      }

      // Separate reports by type
      const similarityReports = classifiedReports.filter(r => r.reportType === 'similarity');
      const aiReports = classifiedReports.filter(r => r.reportType === 'ai');
      const unknownReports = classifiedReports.filter(r => r.reportType === 'unknown' || r.reportType === 'unreadable');

      // Check for conflicts (more than one of each type)
      if (similarityReports.length > 1 || aiReports.length > 1) {
        await supabase
          .from('documents')
          .update({
            needs_review: true,
            review_reason: `Multiple reports of same type: ${similarityReports.length} similarity, ${aiReports.length} AI`,
          })
          .eq('id', doc.id);

        result.needsReview.push({
          documentId: doc.id,
          reason: `Multiple reports of same type detected`,
        });
        result.stats.needsReviewCount++;

        // Store as unmatched
        for (const report of classifiedReports) {
          result.unmatched.push({
            fileName: report.fileName,
            documentKey: docKey,
            filePath: report.filePath,
            reportType: report.reportType,
          });
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: docKey,
            file_path: report.filePath,
            report_type: report.reportType,
            similarity_percentage: report.reportType === 'similarity' ? report.percentage : null,
            ai_percentage: report.reportType === 'ai' ? report.percentage : null,
            uploaded_by: user.id,
          });
        }
        result.stats.unmatchedCount += classifiedReports.length;
        continue;
      }

      // Prepare update data - only update fields for the specific report type
      const updateData: Record<string, unknown> = {};

      // Attach similarity report if found and slot is empty
      if (similarityReports.length === 1 && !doc.similarity_report_path) {
        const simReport = similarityReports[0];
        updateData.similarity_report_path = simReport.filePath;
        if (simReport.percentage !== null) {
          updateData.similarity_percentage = simReport.percentage;
        }
        
        result.mapped.push({
          documentId: doc.id,
          fileName: simReport.fileName,
          reportType: 'similarity',
          percentage: simReport.percentage,
          success: true,
        });
        result.stats.mappedCount++;
      }

      // Attach AI report if found and slot is empty
      if (aiReports.length === 1 && !doc.ai_report_path) {
        const aiReport = aiReports[0];
        updateData.ai_report_path = aiReport.filePath;
        if (aiReport.percentage !== null) {
          updateData.ai_percentage = aiReport.percentage;
        }
        
        result.mapped.push({
          documentId: doc.id,
          fileName: aiReport.fileName,
          reportType: 'ai',
          percentage: aiReport.percentage,
          success: true,
        });
        result.stats.mappedCount++;
      }

      // Handle unknown/unreadable reports - add to unmatched for manual review
      for (const unknownReport of unknownReports) {
        result.unmatched.push({
          fileName: unknownReport.fileName,
          documentKey: docKey,
          filePath: unknownReport.filePath,
          reportType: unknownReport.reportType,
        });
        await supabase.from('unmatched_reports').insert({
          file_name: unknownReport.fileName,
          normalized_filename: docKey,
          file_path: unknownReport.filePath,
          report_type: unknownReport.reportType,
          uploaded_by: user.id,
        });
        result.stats.unmatchedCount++;
      }

      // Update document if we have changes
      if (Object.keys(updateData).length > 0) {
        // Check if document is now complete (has both reports)
        const willHaveBothReports = 
          (updateData.similarity_report_path || doc.similarity_report_path) &&
          (updateData.ai_report_path || doc.ai_report_path);

        if (willHaveBothReports) {
          updateData.status = 'completed';
          updateData.completed_at = new Date().toISOString();
          result.completedDocuments.push(doc.id);
          result.stats.completedCount++;
        }

        const { error: updateError } = await supabase
          .from('documents')
          .update(updateData)
          .eq('id', doc.id);

        if (updateError) {
          console.error(`Failed to update document ${doc.id}:`, updateError);
        } else {
          console.log(`Updated document ${doc.id} with:`, updateData);
        }
      }
    }

    console.log('Bulk report processing complete:', result.stats);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in bulk report upload:', error);
    return new Response(JSON.stringify({ 
      error: 'An error occurred during processing',
      details: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
