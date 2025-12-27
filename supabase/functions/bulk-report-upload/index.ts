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

interface OCRResult {
  success: boolean;
  text: string;
  error?: string;
}

interface ReportClassification {
  reportType: 'similarity' | 'ai' | 'unknown';
  percentage: number | null;
  ocrText: string;
  isUnreadable: boolean;
}

interface DryRunResult {
  documentId: string;
  documentFileName: string;
  reports: {
    fileName: string;
    filePath: string;
    classification: ReportClassification;
    action: 'assign_similarity' | 'assign_ai' | 'skip_duplicate' | 'unmatched' | 'needs_review';
    reason?: string;
  }[];
  willComplete: boolean;
  hasConflict: boolean;
  conflictReason?: string;
}

interface ProcessingResult {
  success: boolean;
  dryRun: DryRunResult[];
  committed: {
    documentId: string;
    similarityAssigned: boolean;
    aiAssigned: boolean;
    newStatus: string;
  }[];
  unmatched: { fileName: string; normalizedFilename: string; filePath: string; reason: string }[];
  needsReview: { documentId: string; reason: string }[];
  stats: {
    totalReports: number;
    similarityDetected: number;
    aiDetected: number;
    unknownType: number;
    unreadable: number;
    mappedCount: number;
    unmatchedCount: number;
    completedCount: number;
    needsReviewCount: number;
  };
}

/**
 * STAGE 1 — DOCUMENT GROUPING (FILENAME BASED)
 * 
 * Normalize filename:
 * - Remove file extension
 * - Remove trailing numbers like (1), (2), (45)
 * - Remove surrounding brackets [] or ()
 * - Normalize spaces and casing
 */
function normalizeFilename(filename: string): string {
  let result = filename.toLowerCase();
  
  // Remove file extension
  result = result.replace(/\.[^.]+$/, '');
  
  // Remove trailing (number) patterns - can be multiple like (1) (2)
  result = result.replace(/\s*\(\d+\)\s*$/g, '');
  
  // Remove leading/trailing brackets content if wrapping entire name
  // e.g., "(Reflective Writing)" -> "Reflective Writing"
  // e.g., "[Guest] Document" -> "Guest Document"
  if (result.startsWith('(') && result.includes(')')) {
    result = result.replace(/^\(([^)]+)\)/, '$1');
  }
  if (result.startsWith('[') && result.includes(']')) {
    result = result.replace(/^\[([^\]]+)\]/, '$1');
  }
  
  // Collapse multiple spaces
  result = result.replace(/\s+/g, ' ');
  
  // Trim
  result = result.trim();
  
  return result;
}

/**
 * STAGE 2 — OCR (MANDATORY)
 * Uses OCR.space API to extract text from PDF
 * Note: Free tier processes all pages, we extract relevant content from combined text
 */
async function performOCR(pdfUrl: string, ocrApiKey: string): Promise<OCRResult> {
  try {
    console.log(`Performing OCR on: ${pdfUrl}`);
    
    // URL encode the PDF URL to prevent parameter parsing issues
    const encodedUrl = encodeURIComponent(pdfUrl);
    
    // OCR.space API - process PDF with OCREngine=2 for better accuracy
    const formData = new FormData();
    formData.append('url', pdfUrl);
    formData.append('apikey', ocrApiKey);
    formData.append('filetype', 'PDF');
    formData.append('OCREngine', '2');
    formData.append('isTable', 'true');
    formData.append('scale', 'true');
    
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      console.error(`OCR API error: ${response.status}`);
      return { success: false, text: '', error: `OCR API returned ${response.status}` };
    }
    
    const result = await response.json();
    
    if (result.IsErroredOnProcessing) {
      console.error('OCR processing error:', result.ErrorMessage);
      return { success: false, text: '', error: result.ErrorMessage?.[0] || 'OCR processing failed' };
    }
    
    if (!result.ParsedResults || result.ParsedResults.length === 0) {
      console.error('No OCR results returned');
      return { success: false, text: '', error: 'No OCR results' };
    }
    
    // Combine text from all parsed pages (page 2 content will be included)
    let extractedText = '';
    for (const parsed of result.ParsedResults) {
      if (parsed.ParsedText) {
        extractedText += ' ' + parsed.ParsedText;
      }
    }
    
    // Normalize OCR output: lowercase, collapse whitespace
    const normalizedText = extractedText.toLowerCase().replace(/\s+/g, ' ').trim();
    
    console.log(`OCR extracted ${normalizedText.length} characters from ${result.ParsedResults.length} page(s)`);
    
    return { success: true, text: normalizedText };
  } catch (error) {
    console.error('OCR error:', error);
    return { success: false, text: '', error: error instanceof Error ? error.message : 'Unknown OCR error' };
  }
}

/**
 * STAGE 3 — REPORT TYPE DETECTION
 * Uses OCR text to classify as Similarity or AI report
 */
function classifyReportType(ocrText: string): 'similarity' | 'ai' | 'unknown' {
  const text = ocrText.toLowerCase();
  
  // Similarity Report keywords
  const similarityKeywords = [
    'overall similarity',
    'match groups',
    'integrity overview',
  ];
  
  // AI Report keywords
  const aiKeywords = [
    'detected as ai',
    'ai writing overview',
    'detection groups',
  ];
  
  for (const keyword of similarityKeywords) {
    if (text.includes(keyword)) {
      console.log(`Classified as SIMILARITY - matched: "${keyword}"`);
      return 'similarity';
    }
  }
  
  for (const keyword of aiKeywords) {
    if (text.includes(keyword)) {
      console.log(`Classified as AI - matched: "${keyword}"`);
      return 'ai';
    }
  }
  
  console.log('Could not classify report type - no keywords matched');
  return 'unknown';
}

/**
 * STAGE 4 — PERCENTAGE EXTRACTION
 * Extract percentage values from OCR text
 */
function extractPercentage(ocrText: string, reportType: 'similarity' | 'ai'): number | null {
  const text = ocrText.toLowerCase();
  
  if (reportType === 'similarity') {
    // Pattern: (\d{1,3})\s*%\s*overall similarity
    const match = text.match(/(\d{1,3})\s*%\s*overall similarity/);
    if (match) {
      const percentage = parseInt(match[1], 10);
      console.log(`Extracted similarity percentage: ${percentage}%`);
      return percentage;
    }
  }
  
  if (reportType === 'ai') {
    // Pattern: (\d{1,3})\s*%\s*detected as ai
    const match = text.match(/(\d{1,3})\s*%\s*detected as ai/);
    if (match) {
      const percentage = parseInt(match[1], 10);
      console.log(`Extracted AI percentage: ${percentage}%`);
      return percentage;
    }
    
    // Check for "*% detected as AI" case - means NULL
    if (text.includes('*') && text.includes('detected as ai')) {
      console.log('AI percentage shows asterisk - setting to NULL');
      return null;
    }
  }
  
  console.log(`Could not extract ${reportType} percentage`);
  return null;
}

/**
 * Classify a report using OCR
 */
async function classifyReport(
  filePath: string, 
  supabaseUrl: string,
  supabaseKey: string,
  ocrApiKey: string
): Promise<ReportClassification> {
  // Generate signed URL for the PDF
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('reports')
    .createSignedUrl(filePath, 300); // 5 minutes
  
  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error('Failed to create signed URL:', signedUrlError);
    return {
      reportType: 'unknown',
      percentage: null,
      ocrText: '',
      isUnreadable: true,
    };
  }
  
  // Perform OCR
  const ocrResult = await performOCR(signedUrlData.signedUrl, ocrApiKey);
  
  if (!ocrResult.success) {
    console.error(`OCR failed for ${filePath}: ${ocrResult.error}`);
    return {
      reportType: 'unknown',
      percentage: null,
      ocrText: ocrResult.error || 'OCR failed',
      isUnreadable: true,
    };
  }
  
  // Classify report type
  const reportType = classifyReportType(ocrResult.text);
  
  // Extract percentage if type is known
  let percentage: number | null = null;
  if (reportType !== 'unknown') {
    percentage = extractPercentage(ocrResult.text, reportType);
  }
  
  return {
    reportType,
    percentage,
    ocrText: ocrResult.text.substring(0, 500), // Truncate for logging
    isUnreadable: false,
  };
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
      return new Response(JSON.stringify({ error: 'OCR API key not configured' }), {
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

    console.log(`=== BULK REPORT UPLOAD - Processing ${reports.length} reports ===`);

    // Initialize result
    const result: ProcessingResult = {
      success: true,
      dryRun: [],
      committed: [],
      unmatched: [],
      needsReview: [],
      stats: {
        totalReports: reports.length,
        similarityDetected: 0,
        aiDetected: 0,
        unknownType: 0,
        unreadable: 0,
        mappedCount: 0,
        unmatchedCount: 0,
        completedCount: 0,
        needsReviewCount: 0,
      },
    };

    // Fetch all pending and in_progress documents
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, normalized_filename, user_id, similarity_report_path, ai_report_path, similarity_percentage, ai_percentage, status, needs_review')
      .in('status', ['pending', 'in_progress']);

    if (docError) {
      console.error('Error fetching documents:', docError);
      throw new Error('Failed to fetch documents');
    }

    console.log(`Found ${documents?.length || 0} pending/in_progress documents`);

    // ========================================
    // STAGE 1: NORMALIZE & GROUP
    // ========================================
    console.log('=== STAGE 1: DOCUMENT GROUPING ===');
    
    // Normalize report filenames
    const normalizedReports = reports.map(r => ({
      ...r,
      normalizedFilename: normalizeFilename(r.fileName),
    }));
    
    // Group documents by normalized filename
    const docsByNormalized = new Map<string, typeof documents>();
    for (const doc of documents || []) {
      const normalized = doc.normalized_filename || normalizeFilename(doc.file_name);
      if (!docsByNormalized.has(normalized)) {
        docsByNormalized.set(normalized, []);
      }
      docsByNormalized.get(normalized)!.push(doc);
    }
    
    // Group reports by normalized filename
    const reportsByNormalized = new Map<string, typeof normalizedReports>();
    for (const report of normalizedReports) {
      if (!reportsByNormalized.has(report.normalizedFilename)) {
        reportsByNormalized.set(report.normalizedFilename, []);
      }
      reportsByNormalized.get(report.normalizedFilename)!.push(report);
    }
    
    console.log(`Document groups: ${docsByNormalized.size}`);
    console.log(`Report groups: ${reportsByNormalized.size}`);

    // ========================================
    // STAGE 2-4: OCR, CLASSIFY, EXTRACT PERCENTAGE
    // ========================================
    console.log('=== STAGE 2-4: OCR & CLASSIFICATION ===');
    
    const classifiedReports = new Map<string, ReportClassification>();
    
    for (const report of normalizedReports) {
      console.log(`\nProcessing report: ${report.fileName}`);
      console.log(`Normalized to: ${report.normalizedFilename}`);
      
      const classification = await classifyReport(
        report.filePath,
        supabaseUrl,
        supabaseServiceKey,
        ocrApiKey
      );
      
      classifiedReports.set(report.filePath, classification);
      
      // Update stats
      if (classification.isUnreadable) {
        result.stats.unreadable++;
      } else if (classification.reportType === 'similarity') {
        result.stats.similarityDetected++;
      } else if (classification.reportType === 'ai') {
        result.stats.aiDetected++;
      } else {
        result.stats.unknownType++;
      }
      
      console.log(`Classification: ${classification.reportType}, Percentage: ${classification.percentage}`);
    }

    // ========================================
    // STAGE 6: DRY RUN (MANDATORY)
    // ========================================
    console.log('\n=== STAGE 6: DRY RUN VALIDATION ===');
    
    const dryRunResults: DryRunResult[] = [];
    const documentsToUpdate = new Map<string, {
      similarityPath?: string;
      similarityPercentage?: number | null;
      aiPath?: string;
      aiPercentage?: number | null;
      needsReview?: boolean;
      reviewReason?: string;
    }>();
    
    for (const [normalizedName, matchingReports] of reportsByNormalized) {
      const matchingDocs = docsByNormalized.get(normalizedName) || [];
      
      console.log(`\nDry run for "${normalizedName}": ${matchingReports.length} reports, ${matchingDocs.length} docs`);
      
      // No matching documents - all reports are unmatched
      if (matchingDocs.length === 0) {
        for (const report of matchingReports) {
          const classification = classifiedReports.get(report.filePath)!;
          result.unmatched.push({
            fileName: report.fileName,
            normalizedFilename: normalizedName,
            filePath: report.filePath,
            reason: 'No matching document found',
          });
        }
        continue;
      }
      
      // Multiple documents with same normalized name - ambiguous
      if (matchingDocs.length > 1) {
        for (const doc of matchingDocs) {
          documentsToUpdate.set(doc.id, {
            needsReview: true,
            reviewReason: `Multiple documents share normalized filename: ${normalizedName}`,
          });
          result.needsReview.push({
            documentId: doc.id,
            reason: 'Multiple documents with same normalized filename',
          });
        }
        for (const report of matchingReports) {
          result.unmatched.push({
            fileName: report.fileName,
            normalizedFilename: normalizedName,
            filePath: report.filePath,
            reason: 'Ambiguous - multiple documents match',
          });
        }
        continue;
      }
      
      // Exactly one document - proceed with validation
      const doc = matchingDocs[0];
      const dryRunItem: DryRunResult = {
        documentId: doc.id,
        documentFileName: doc.file_name,
        reports: [],
        willComplete: false,
        hasConflict: false,
      };
      
      let pendingSimilarity: { path: string; percentage: number | null } | null = null;
      let pendingAi: { path: string; percentage: number | null } | null = null;
      
      for (const report of matchingReports) {
        const classification = classifiedReports.get(report.filePath)!;
        
        // Handle unreadable reports
        if (classification.isUnreadable) {
          dryRunItem.reports.push({
            fileName: report.fileName,
            filePath: report.filePath,
            classification,
            action: 'needs_review',
            reason: 'OCR failed - report unreadable',
          });
          dryRunItem.hasConflict = true;
          dryRunItem.conflictReason = 'Contains unreadable report(s)';
          continue;
        }
        
        // Handle unknown type
        if (classification.reportType === 'unknown') {
          dryRunItem.reports.push({
            fileName: report.fileName,
            filePath: report.filePath,
            classification,
            action: 'needs_review',
            reason: 'Could not determine report type from OCR',
          });
          dryRunItem.hasConflict = true;
          dryRunItem.conflictReason = 'Contains unknown report type(s)';
          continue;
        }
        
        // Check for duplicates
        if (classification.reportType === 'similarity') {
          if (doc.similarity_report_path || pendingSimilarity) {
            dryRunItem.reports.push({
              fileName: report.fileName,
              filePath: report.filePath,
              classification,
              action: 'skip_duplicate',
              reason: 'Similarity report already exists',
            });
            dryRunItem.hasConflict = true;
            dryRunItem.conflictReason = 'Duplicate similarity reports detected';
          } else {
            pendingSimilarity = { path: report.filePath, percentage: classification.percentage };
            dryRunItem.reports.push({
              fileName: report.fileName,
              filePath: report.filePath,
              classification,
              action: 'assign_similarity',
            });
          }
        } else if (classification.reportType === 'ai') {
          if (doc.ai_report_path || pendingAi) {
            dryRunItem.reports.push({
              fileName: report.fileName,
              filePath: report.filePath,
              classification,
              action: 'skip_duplicate',
              reason: 'AI report already exists',
            });
            dryRunItem.hasConflict = true;
            dryRunItem.conflictReason = 'Duplicate AI reports detected';
          } else {
            pendingAi = { path: report.filePath, percentage: classification.percentage };
            dryRunItem.reports.push({
              fileName: report.fileName,
              filePath: report.filePath,
              classification,
              action: 'assign_ai',
            });
          }
        }
      }
      
      // Validate percentages
      if (pendingSimilarity && pendingSimilarity.percentage !== null) {
        if (pendingSimilarity.percentage < 0 || pendingSimilarity.percentage > 100) {
          dryRunItem.hasConflict = true;
          dryRunItem.conflictReason = `Invalid similarity percentage: ${pendingSimilarity.percentage}`;
        }
      }
      if (pendingAi && pendingAi.percentage !== null) {
        if (pendingAi.percentage < 0 || pendingAi.percentage > 100) {
          dryRunItem.hasConflict = true;
          dryRunItem.conflictReason = `Invalid AI percentage: ${pendingAi.percentage}`;
        }
      }
      
      // Determine if document will be completed
      const hasSimilarity = doc.similarity_report_path || pendingSimilarity;
      const hasAi = doc.ai_report_path || pendingAi;
      dryRunItem.willComplete = !!(hasSimilarity && hasAi) && !dryRunItem.hasConflict;
      
      // Store pending updates (only if no conflict)
      if (!dryRunItem.hasConflict) {
        const updateData: typeof documentsToUpdate extends Map<string, infer V> ? V : never = {};
        if (pendingSimilarity) {
          updateData.similarityPath = pendingSimilarity.path;
          updateData.similarityPercentage = pendingSimilarity.percentage;
        }
        if (pendingAi) {
          updateData.aiPath = pendingAi.path;
          updateData.aiPercentage = pendingAi.percentage;
        }
        if (Object.keys(updateData).length > 0) {
          documentsToUpdate.set(doc.id, updateData);
        }
      } else {
        // Mark for review due to conflict
        documentsToUpdate.set(doc.id, {
          needsReview: true,
          reviewReason: dryRunItem.conflictReason,
        });
        result.needsReview.push({
          documentId: doc.id,
          reason: dryRunItem.conflictReason || 'Validation failed',
        });
      }
      
      dryRunResults.push(dryRunItem);
    }
    
    result.dryRun = dryRunResults;

    // ========================================
    // STAGE 7: COMMIT PHASE
    // ========================================
    console.log('\n=== STAGE 7: COMMIT PHASE ===');
    
    for (const [docId, updates] of documentsToUpdate) {
      const doc = (documents || []).find(d => d.id === docId);
      if (!doc) continue;
      
      const updateData: Record<string, unknown> = {};
      
      // Handle needs_review flag
      if (updates.needsReview) {
        updateData.needs_review = true;
        updateData.review_reason = updates.reviewReason;
        
        const { error } = await supabase
          .from('documents')
          .update(updateData)
          .eq('id', docId);
        
        if (error) {
          console.error(`Failed to update document ${docId}:`, error);
        } else {
          console.log(`Document ${docId} marked for review`);
        }
        continue;
      }
      
      // Update report paths and percentages (never overwrite existing valid values)
      if (updates.similarityPath && !doc.similarity_report_path) {
        updateData.similarity_report_path = updates.similarityPath;
        if (updates.similarityPercentage !== undefined) {
          updateData.similarity_percentage = updates.similarityPercentage;
        }
      }
      if (updates.aiPath && !doc.ai_report_path) {
        updateData.ai_report_path = updates.aiPath;
        if (updates.aiPercentage !== undefined) {
          updateData.ai_percentage = updates.aiPercentage;
        }
      }
      
      // Determine new status
      const hasSimilarity = doc.similarity_report_path || updates.similarityPath;
      const hasAi = doc.ai_report_path || updates.aiPath;
      
      if (hasSimilarity && hasAi) {
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
        updateData.assigned_staff_id = user.id;
        updateData.assigned_at = new Date().toISOString();
      } else if (hasSimilarity || hasAi) {
        updateData.status = 'in_progress';
      }
      
      if (Object.keys(updateData).length > 0) {
        const { error } = await supabase
          .from('documents')
          .update(updateData)
          .eq('id', docId);
        
        if (error) {
          console.error(`Failed to update document ${docId}:`, error);
        } else {
          console.log(`Document ${docId} updated:`, updateData);
          
          result.committed.push({
            documentId: docId,
            similarityAssigned: !!updates.similarityPath,
            aiAssigned: !!updates.aiPath,
            newStatus: (updateData.status as string) || doc.status,
          });
          
          if (updateData.status === 'completed') {
            result.stats.completedCount++;
            
            // Send notifications
            if (doc.user_id) {
              // Create user notification
              await supabase.from('user_notifications').insert({
                user_id: doc.user_id,
                title: 'Document Completed',
                message: `Your document "${doc.file_name}" has been processed and is ready for download.`,
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
                    userId: doc.user_id,
                    title: 'Document Completed',
                    body: `Your document "${doc.file_name}" is ready!`,
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
                    userId: doc.user_id,
                    fileName: doc.file_name,
                  }),
                });
              } catch (emailError) {
                console.error('Failed to send completion email:', emailError);
              }
            }
          }
        }
      }
      
      result.stats.mappedCount += (updates.similarityPath ? 1 : 0) + (updates.aiPath ? 1 : 0);
    }
    
    // Store unmatched reports in database
    for (const unmatched of result.unmatched) {
      const classification = classifiedReports.get(unmatched.filePath);
      await supabase.from('unmatched_reports').insert({
        file_name: unmatched.fileName,
        normalized_filename: unmatched.normalizedFilename,
        file_path: unmatched.filePath,
        report_type: classification?.reportType || null,
        similarity_percentage: classification?.reportType === 'similarity' ? classification.percentage : null,
        ai_percentage: classification?.reportType === 'ai' ? classification.percentage : null,
        uploaded_by: user.id,
      });
    }
    
    // Update final stats
    result.stats.unmatchedCount = result.unmatched.length;
    result.stats.needsReviewCount = result.needsReview.length;

    console.log('\n=== PROCESSING COMPLETE ===');
    console.log('Stats:', result.stats);

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
