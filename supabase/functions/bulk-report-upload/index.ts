import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportFile {
  fileName: string;
  filePath: string;
  normalizedFilename: string;
}

interface ClassificationResult {
  reportType: 'similarity' | 'ai' | 'unknown';
  similarityPercentage: number | null;
  aiPercentage: number | null;
  ocrText: string;
  error?: string;
}

interface MappingResult {
  documentId: string;
  fileName: string;
  reportType: 'similarity' | 'ai' | 'unknown';
  similarityPercentage: number | null;
  aiPercentage: number | null;
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

// =====================================================
// STAGE 1 — FILENAME NORMALIZATION
// =====================================================

/**
 * Normalize filename for CUSTOMER documents (base name).
 * Removes file extension only, keeps everything else including brackets.
 */
function getDocumentBaseName(filename: string): string {
  let result = filename.toLowerCase();
  result = result.replace(/\.[^.]+$/, '');
  return result.trim();
}

/**
 * Normalize filename for REPORT files.
 * Removes extension AND trailing numbers like (1), (2), (45).
 * Also removes surrounding brackets [] or ().
 */
function normalizeReportFilename(filename: string): string {
  let result = filename.toLowerCase();
  // Remove file extension
  result = result.replace(/\.[^.]+$/, '');
  // Remove trailing " (number)" patterns
  result = result.replace(/\s*\(\d+\)\s*$/g, '');
  // Remove surrounding brackets if present
  result = result.replace(/^\[|\]$/g, '').replace(/^\(|\)$/g, '');
  // Normalize spacing
  result = result.replace(/\s+/g, ' ');
  return result.trim();
}

// =====================================================
// STAGE 2 — LOCAL PDF TEXT EXTRACTION
// =====================================================

/**
 * Extract text from PDF by parsing the raw bytes.
 * This works for text-based PDFs (like Turnitin reports).
 * For scanned PDFs, it will return empty or minimal text.
 */
async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(pdfBuffer);
    const decoder = new TextDecoder('latin1');
    const rawText = decoder.decode(uint8Array);
    
    const textMatches: string[] = [];
    
    // Method 1: Extract text from PDF text objects (Tj, TJ operators)
    const tjPattern = /\(([^)]*)\)\s*(?:Tj|TJ|\'|\")/g;
    let match;
    while ((match = tjPattern.exec(rawText)) !== null) {
      if (match[1]) {
        let text = match[1]
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\')
          .replace(/\\([()])/g, '$1');
        textMatches.push(text);
      }
    }
    
    // Method 2: Extract hex-encoded text <XXXX>
    const hexPattern = /<([0-9A-Fa-f]+)>\s*(?:Tj|TJ)/g;
    while ((match = hexPattern.exec(rawText)) !== null) {
      if (match[1] && match[1].length % 2 === 0) {
        let text = '';
        for (let i = 0; i < match[1].length; i += 2) {
          const charCode = parseInt(match[1].substr(i, 2), 16);
          if (charCode >= 32 && charCode <= 126) {
            text += String.fromCharCode(charCode);
          }
        }
        if (text) textMatches.push(text);
      }
    }
    
    // Method 3: Look for readable text patterns in raw content
    const readablePattern = /[A-Za-z]{3,}[A-Za-z\s]{2,}/g;
    while ((match = readablePattern.exec(rawText)) !== null) {
      if (match[0].length > 5) {
        textMatches.push(match[0]);
      }
    }
    
    const extractedText = textMatches.join(' ');
    console.log(`Extracted ${extractedText.length} characters from PDF`);
    
    return extractedText;
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Normalize text for classification.
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

// =====================================================
// STAGE 3 — REPORT TYPE DETECTION
// =====================================================

/**
 * Classify report type based on extracted text content.
 */
function classifyReport(text: string): 'similarity' | 'ai' | 'unknown' {
  const normalized = normalizeText(text);
  
  const similarityIndicators = [
    'overall similarity',
    'match groups',
    'integrity overview',
    'similarity index',
    'internet sources',
    'publications',
    'student papers',
  ];
  
  const aiIndicators = [
    'detected as ai',
    'ai writing overview',
    'detection groups',
    'ai writing detection',
    'human written',
    'ai generated',
  ];
  
  const hasSimilarityIndicator = similarityIndicators.some(i => normalized.includes(i));
  const hasAiIndicator = aiIndicators.some(i => normalized.includes(i));
  
  if (hasSimilarityIndicator && hasAiIndicator) {
    const similarityCount = similarityIndicators.filter(i => normalized.includes(i)).length;
    const aiCount = aiIndicators.filter(i => normalized.includes(i)).length;
    return aiCount > similarityCount ? 'ai' : 'similarity';
  }
  
  if (hasAiIndicator) return 'ai';
  if (hasSimilarityIndicator) return 'similarity';
  
  return 'unknown';
}

// =====================================================
// STAGE 4 — PERCENTAGE EXTRACTION
// =====================================================

/**
 * Extract similarity percentage from text.
 */
function extractSimilarityPercentage(text: string): number | null {
  const normalized = normalizeText(text);
  
  const patterns = [
    /(\d{1,3})\s*%\s*overall\s*similarity/i,
    /overall\s*similarity[:\s]*(\d{1,3})\s*%/i,
    /similarity\s*index[:\s]*(\d{1,3})\s*%/i,
  ];
  
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      const value = parseInt(match[1], 10);
      if (value >= 0 && value <= 100) return value;
    }
  }
  
  return null;
}

/**
 * Extract AI percentage from text.
 * Returns null if "*%" is found (asterisk indicates unavailable)
 */
function extractAiPercentage(text: string): number | null {
  const normalized = normalizeText(text);
  
  if (normalized.includes('*%') || normalized.includes('* %')) {
    return null;
  }
  
  const patterns = [
    /(\d{1,3})\s*%\s*detected\s*as\s*ai/i,
    /ai[:\s]*(\d{1,3})\s*%/i,
    /(\d{1,3})\s*%\s*ai\s*generated/i,
    /ai\s*writing[:\s]*(\d{1,3})\s*%/i,
  ];
  
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      const value = parseInt(match[1], 10);
      if (value >= 0 && value <= 100) return value;
    }
  }
  
  return null;
}

// =====================================================
// REPORT PROCESSING
// =====================================================

/**
 * Process a single report file: download, extract text, classify, extract percentages.
 */
async function processReport(
  supabase: SupabaseClient,
  report: ReportFile
): Promise<ClassificationResult> {
  try {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('reports')
      .download(report.filePath);
    
    if (downloadError || !fileData) {
      console.error(`Failed to download report ${report.fileName}:`, downloadError);
      return {
        reportType: 'unknown',
        similarityPercentage: null,
        aiPercentage: null,
        ocrText: '',
        error: 'Failed to download PDF',
      };
    }
    
    const pdfBuffer = await fileData.arrayBuffer();
    let extractedText: string;
    
    try {
      extractedText = await extractTextFromPDF(pdfBuffer);
    } catch (error) {
      console.error(`Text extraction failed for ${report.fileName}:`, error);
      return {
        reportType: 'unknown',
        similarityPercentage: null,
        aiPercentage: null,
        ocrText: '',
        error: 'Text extraction failed - may be scanned PDF',
      };
    }
    
    if (!extractedText || extractedText.trim().length < 50) {
      console.warn(`Insufficient text extracted from ${report.fileName}`);
      return {
        reportType: 'unknown',
        similarityPercentage: null,
        aiPercentage: null,
        ocrText: extractedText || '',
        error: 'Insufficient text extracted - may be scanned PDF',
      };
    }
    
    const reportType = classifyReport(extractedText);
    
    let similarityPercentage: number | null = null;
    let aiPercentage: number | null = null;
    
    if (reportType === 'similarity') {
      similarityPercentage = extractSimilarityPercentage(extractedText);
    } else if (reportType === 'ai') {
      aiPercentage = extractAiPercentage(extractedText);
    }
    
    console.log(`Classified ${report.fileName}: type=${reportType}, similarity=${similarityPercentage}, ai=${aiPercentage}`);
    
    return {
      reportType,
      similarityPercentage,
      aiPercentage,
      ocrText: extractedText.substring(0, 500),
    };
  } catch (error) {
    console.error(`Error processing report ${report.fileName}:`, error);
    return {
      reportType: 'unknown',
      similarityPercentage: null,
      aiPercentage: null,
      ocrText: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =====================================================
// STAGE 6 — DRY RUN VALIDATION
// =====================================================

interface DryRunResult {
  valid: boolean;
  errors: string[];
}

function performDryRun(
  docsByBaseName: Map<string, any[]>,
  processedReports: Map<string, (ReportFile & ClassificationResult)[]>
): DryRunResult {
  const errors: string[] = [];
  
  for (const [normalized, reports] of processedReports) {
    const matchingDocs = docsByBaseName.get(normalized) || [];
    
    if (matchingDocs.length === 0) continue;
    if (matchingDocs.length > 1) {
      errors.push(`Multiple documents match normalized filename "${normalized}"`);
      continue;
    }
    
    const docId = matchingDocs[0].id;
    const similarityReports = reports.filter(r => r.reportType === 'similarity');
    const aiReports = reports.filter(r => r.reportType === 'ai');
    const unknownReports = reports.filter(r => r.reportType === 'unknown');
    
    if (similarityReports.length > 1) {
      errors.push(`Document ${docId}: Multiple similarity reports`);
    }
    if (aiReports.length > 1) {
      errors.push(`Document ${docId}: Multiple AI reports`);
    }
    if (unknownReports.length > 0) {
      errors.push(`Document ${docId}: ${unknownReports.length} unclassified report(s)`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// =====================================================
// MAIN HANDLER
// =====================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    console.log(`Processing ${reports.length} reports with local text extraction`);

    // Fetch all pending/in_progress documents
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, normalized_filename, user_id, similarity_report_path, ai_report_path, similarity_percentage, ai_percentage, status, needs_review')
      .in('status', ['pending', 'in_progress'])
      .eq('needs_review', false);

    if (docError) {
      console.error('Error fetching documents:', docError);
      throw new Error('Failed to fetch documents');
    }

    console.log(`Found ${documents?.length || 0} pending/in_progress documents`);

    // Group documents by normalized filename
    const docsByBaseName = new Map<string, typeof documents>();
    for (const doc of documents || []) {
      const baseName = doc.normalized_filename || getDocumentBaseName(doc.file_name);
      if (!docsByBaseName.has(baseName)) {
        docsByBaseName.set(baseName, []);
      }
      docsByBaseName.get(baseName)!.push(doc);
    }

    // Process each report - extract text and classify
    const processedReports = new Map<string, (ReportFile & ClassificationResult)[]>();
    
    for (const report of reports) {
      const normalized = normalizeReportFilename(report.fileName);
      report.normalizedFilename = normalized;
      
      console.log(`Processing report: ${report.fileName} -> normalized: ${normalized}`);
      
      const classification = await processReport(supabase, report);
      const processedReport = { ...report, ...classification };
      
      if (!processedReports.has(normalized)) {
        processedReports.set(normalized, []);
      }
      processedReports.get(normalized)!.push(processedReport);
    }

    // DRY RUN - Validate before writing
    const dryRunResult = performDryRun(docsByBaseName, processedReports);
    console.log(`Dry run: valid=${dryRunResult.valid}, errors=${dryRunResult.errors.length}`);
    if (dryRunResult.errors.length > 0) {
      console.log('Dry run errors:', dryRunResult.errors);
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

    // COMMIT PHASE - Write to database
    for (const [normalized, matchingReports] of processedReports) {
      const matchingDocs = docsByBaseName.get(normalized) || [];

      // Case 1: No matching documents
      if (matchingDocs.length === 0) {
        for (const report of matchingReports) {
          result.unmatched.push(report);
          
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: normalized,
            file_path: report.filePath,
            report_type: report.reportType,
            similarity_percentage: report.similarityPercentage,
            ai_percentage: report.aiPercentage,
            uploaded_by: user.id,
          });
        }
        continue;
      }

      // Case 2: Multiple documents - mark for review
      if (matchingDocs.length > 1) {
        for (const doc of matchingDocs) {
          await supabase
            .from('documents')
            .update({
              needs_review: true,
              review_reason: `Multiple documents share normalized filename: ${normalized}`,
            })
            .eq('id', doc.id);

          result.needsReview.push({
            documentId: doc.id,
            reason: 'Multiple documents with same normalized filename',
          });
        }
        
        for (const report of matchingReports) {
          result.unmatched.push(report);
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: normalized,
            file_path: report.filePath,
            report_type: report.reportType,
            similarity_percentage: report.similarityPercentage,
            ai_percentage: report.aiPercentage,
            uploaded_by: user.id,
          });
        }
        continue;
      }

      // Case 3: Single matching document
      const doc = matchingDocs[0];
      const updateData: Record<string, unknown> = {};
      let hasIssues = false;
      const issues: string[] = [];

      const similarityReports = matchingReports.filter(r => r.reportType === 'similarity');
      const aiReports = matchingReports.filter(r => r.reportType === 'ai');
      const unknownReports = matchingReports.filter(r => r.reportType === 'unknown');

      if (similarityReports.length > 1) {
        issues.push(`Multiple similarity reports (${similarityReports.length})`);
        hasIssues = true;
      }
      if (aiReports.length > 1) {
        issues.push(`Multiple AI reports (${aiReports.length})`);
        hasIssues = true;
      }
      if (unknownReports.length > 0) {
        issues.push(`${unknownReports.length} unclassified report(s)`);
        hasIssues = true;
      }

      if (hasIssues) {
        await supabase
          .from('documents')
          .update({
            needs_review: true,
            review_reason: issues.join('; '),
          })
          .eq('id', doc.id);

        result.needsReview.push({
          documentId: doc.id,
          reason: issues.join('; '),
        });
        
        for (const report of matchingReports) {
          result.unmatched.push(report);
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: normalized,
            file_path: report.filePath,
            report_type: report.reportType,
            similarity_percentage: report.similarityPercentage,
            ai_percentage: report.aiPercentage,
            uploaded_by: user.id,
            matched_document_id: doc.id,
          });
        }
        continue;
      }

      // Assign valid reports - NEVER overwrite existing values
      for (const report of matchingReports) {
        if (report.reportType === 'similarity' && !doc.similarity_report_path) {
          updateData.similarity_report_path = report.filePath;
          if (report.similarityPercentage !== null && doc.similarity_percentage === null) {
            updateData.similarity_percentage = report.similarityPercentage;
          }
          result.mapped.push({
            documentId: doc.id,
            fileName: report.fileName,
            reportType: 'similarity',
            similarityPercentage: report.similarityPercentage,
            aiPercentage: null,
            success: true,
          });
          result.stats.mappedCount++;
        } else if (report.reportType === 'ai' && !doc.ai_report_path) {
          updateData.ai_report_path = report.filePath;
          if (report.aiPercentage !== null && doc.ai_percentage === null) {
            updateData.ai_percentage = report.aiPercentage;
          }
          result.mapped.push({
            documentId: doc.id,
            fileName: report.fileName,
            reportType: 'ai',
            similarityPercentage: null,
            aiPercentage: report.aiPercentage,
            success: true,
          });
          result.stats.mappedCount++;
        } else if (report.reportType !== 'unknown') {
          result.unmatched.push(report);
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: normalized,
            file_path: report.filePath,
            report_type: report.reportType,
            similarity_percentage: report.similarityPercentage,
            ai_percentage: report.aiPercentage,
            uploaded_by: user.id,
            matched_document_id: doc.id,
          });
        }
      }

      // Auto-complete if both reports exist
      const hasSimilarity = updateData.similarity_report_path || doc.similarity_report_path;
      const hasAi = updateData.ai_report_path || doc.ai_report_path;

      if (hasSimilarity && hasAi) {
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
        result.completedDocuments.push(doc.id);
        result.stats.completedCount++;
        console.log(`Document ${doc.id} completed with both reports`);
      } else if (Object.keys(updateData).length > 0 && doc.status === 'pending') {
        updateData.status = 'in_progress';
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
      const { data: completedDoc } = await supabase
        .from('documents')
        .select('id, file_name, user_id')
        .eq('id', docId)
        .single();

      if (completedDoc?.user_id) {
        await supabase.from('user_notifications').insert({
          user_id: completedDoc.user_id,
          title: 'Document Completed',
          message: `Your document "${completedDoc.file_name}" has been processed and is ready for download.`,
          created_by: user.id,
        });

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
