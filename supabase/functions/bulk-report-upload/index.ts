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
  extractedText: string;
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
  unmatched: (ReportFile & ClassificationResult)[];
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
// STAGE 1 — FILENAME NORMALIZATION (FOR GROUPING ONLY)
// =====================================================

/**
 * Normalize filename for matching documents to reports.
 * - Remove file extension
 * - Remove trailing numbers like (1), (2), (45)
 * - Remove surrounding brackets [] or ()
 * - Normalize spaces and casing
 */
function normalizeFilename(filename: string): string {
  let result = filename.toLowerCase();
  
  // Remove file extension
  result = result.replace(/\.[^.]+$/, '');
  
  // Remove trailing " (number)" patterns like (1), (2), (45)
  result = result.replace(/\s*\(\d+\)\s*$/g, '');
  
  // Remove surrounding brackets if present
  result = result.replace(/^\[/, '').replace(/\]$/, '');
  result = result.replace(/^\(/, '').replace(/\)$/, '');
  
  // Normalize multiple spaces to single space
  result = result.replace(/\s+/g, ' ');
  
  return result.trim();
}

// =====================================================
// STAGE 2 — PDF TEXT EXTRACTION (USING PDF-LIB)
// =====================================================

/**
 * Decompress FlateDecode data.
 * Some PDFs use zlib-wrapped deflate, others raw deflate.
 * Returns null if decompression fails (never throws) to avoid crashing the function.
 */
async function inflateData(compressedData: Uint8Array): Promise<Uint8Array | null> {
  const tryDecompress = async (format: 'deflate' | 'deflate-raw') => {
    const ds = new DecompressionStream(format);
    const writer = ds.writable.getWriter();

    // Create a fresh ArrayBuffer to avoid SharedArrayBuffer typing/runtime issues
    const buffer = new ArrayBuffer(compressedData.length);
    const view = new Uint8Array(buffer);
    view.set(compressedData);

    await writer.write(view);
    await writer.close();

    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  };

  try {
    return await tryDecompress('deflate');
  } catch (error1) {
    try {
      return await tryDecompress('deflate-raw');
    } catch (error2) {
      console.error('Decompression failed (deflate + deflate-raw):', {
        error1: error1 instanceof Error ? error1.message : String(error1),
        error2: error2 instanceof Error ? error2.message : String(error2),
      });
      return null;
    }
  }
}

/**
 * Extract text from PDF by parsing the raw structure
 * Handles both compressed and uncompressed content streams
 */
async function extractTextFromPDF(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    const uint8Array = new Uint8Array(pdfBuffer);
    const rawText = new TextDecoder('latin1').decode(uint8Array);
    
    const allText: string[] = [];
    
    // Find all stream content
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let streamMatch;
    
    while ((streamMatch = streamRegex.exec(rawText)) !== null) {
      const streamContent = streamMatch[1];
      const streamStartIndex = streamMatch.index;
      
      // Check if stream is FlateDecode compressed
      const objHeader = rawText.substring(Math.max(0, streamStartIndex - 500), streamStartIndex);
      const isCompressed = objHeader.includes('/FlateDecode');
      
      let textContent = '';
      
      if (isCompressed) {
        // Get bytes for this stream
        const streamBytes = new Uint8Array(streamContent.length);
        for (let i = 0; i < streamContent.length; i++) {
          streamBytes[i] = streamContent.charCodeAt(i);
        }

        const decompressed = await inflateData(streamBytes);
        if (!decompressed) {
          // Skip if decompression fails
          continue;
        }
        textContent = new TextDecoder('latin1').decode(decompressed);
      } else {
        textContent = streamContent;
      }
      
      // Extract text from PDF text operators
      // Method 1: Extract from (text)Tj operators
      const tjMatches = textContent.matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|TJ|'|")/g);
      for (const match of tjMatches) {
        let text = match[1]
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\')
          .replace(/\\([()])/g, '$1')
          .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
        
        // Only keep if has readable characters
        if (/[a-zA-Z]/.test(text)) {
          allText.push(text);
        }
      }
      
      // Method 2: Extract from TJ arrays [(...) ... (...)]TJ
      const tjArrayMatches = textContent.matchAll(/\[((?:\([^)]*\)|[^\]])*)\]\s*TJ/gi);
      for (const arrayMatch of tjArrayMatches) {
        const arrayContent = arrayMatch[1];
        const innerMatches = arrayContent.matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g);
        for (const inner of innerMatches) {
          let text = inner[1]
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t')
            .replace(/\\\\/g, '\\')
            .replace(/\\([()])/g, '$1')
            .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
          
          if (/[a-zA-Z]/.test(text)) {
            allText.push(text);
          }
        }
      }
      
      // Method 3: Extract hex-encoded text <hex>Tj
      const hexMatches = textContent.matchAll(/<([0-9A-Fa-f]+)>\s*(?:Tj|TJ)/g);
      for (const hexMatch of hexMatches) {
        const hex = hexMatch[1];
        let text = '';
        // Try as UTF-16BE first (common in PDFs)
        if (hex.length % 4 === 0) {
          for (let i = 0; i < hex.length; i += 4) {
            const charCode = parseInt(hex.substr(i, 4), 16);
            if (charCode >= 32 && charCode < 65536) {
              text += String.fromCharCode(charCode);
            }
          }
        } else {
          // Try as single-byte
          for (let i = 0; i < hex.length; i += 2) {
            const charCode = parseInt(hex.substr(i, 2), 16);
            if (charCode >= 32 && charCode <= 126) {
              text += String.fromCharCode(charCode);
            }
          }
        }
        if (text.length > 0 && /[a-zA-Z]/.test(text)) {
          allText.push(text);
        }
      }
    }
    
    const extractedText = allText.join(' ');
    console.log(`Extracted ${extractedText.length} characters from PDF`);
    
    // Log a sample of extracted text for debugging
    if (extractedText.length > 0) {
      const sample = extractedText.substring(0, 500).replace(/\s+/g, ' ');
      console.log(`Text sample: ${sample}...`);
    } else {
      console.log('No text extracted from PDF');
    }
    
    return extractedText;
  } catch (error) {
    console.error('PDF text extraction failed:', error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Normalize extracted text for classification.
 * - Convert to lowercase
 * - Collapse whitespace
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

// =====================================================
// STAGE 3 — REPORT TYPE DETECTION (TEXT-BASED ONLY)
// =====================================================

/**
 * Classify report type based on extracted text content.
 * Filenames are NOT used for classification.
 */
function classifyReport(text: string): 'similarity' | 'ai' | 'unknown' {
  const normalized = normalizeText(text);
  
  // Similarity report indicators
  const similarityIndicators = [
    'overall similarity',
    'match groups',
    'integrity overview',
    'similarity index',
    'internet sources',
    'publications',
    'student papers',
  ];
  
  // AI report indicators
  const aiIndicators = [
    'detected as ai',
    'ai writing overview',
    'detection groups',
    'ai writing detection',
    'human written',
    'ai generated',
  ];
  
  const hasSimilarityIndicator = similarityIndicators.some(indicator => 
    normalized.includes(indicator)
  );
  
  const hasAiIndicator = aiIndicators.some(indicator => 
    normalized.includes(indicator)
  );
  
  // If both indicators found, count which has more matches
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
 * Pattern: (\d{1,3})\s*%\s*overall similarity
 */
function extractSimilarityPercentage(text: string): number | null {
  const normalized = normalizeText(text);
  
  const patterns = [
    /(\d{1,3})\s*%\s*overall\s*similarity/i,
    /overall\s*similarity[:\s]*(\d{1,3})\s*%/i,
    /similarity\s*index[:\s]*(\d{1,3})\s*%/i,
    /(\d{1,3})\s*%\s*similarity/i,
  ];
  
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      const value = parseInt(match[1], 10);
      if (value >= 0 && value <= 100) {
        return value;
      }
    }
  }
  
  return null;
}

/**
 * Extract AI percentage from text.
 * Pattern: (\d{1,3})\s*%\s*detected as ai
 * Special case: *% detected as ai → returns null
 */
function extractAiPercentage(text: string): number | null {
  const normalized = normalizeText(text);
  
  // Check for asterisk which indicates unavailable percentage
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
      if (value >= 0 && value <= 100) {
        return value;
      }
    }
  }
  
  return null;
}

// =====================================================
// REPORT PROCESSING
// =====================================================

/**
 * Process a single report file:
 * 1. Download PDF from storage
 * 2. Extract text using raw PDF parsing
 * 3. Classify report type
 * 4. Extract percentage
 */
async function processReport(
  supabase: SupabaseClient,
  report: ReportFile
): Promise<ClassificationResult> {
  try {
    // Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('reports')
      .download(report.filePath);
    
    if (downloadError || !fileData) {
      console.error(`Failed to download report ${report.fileName}:`, downloadError);
      return {
        reportType: 'unknown',
        similarityPercentage: null,
        aiPercentage: null,
        extractedText: '',
        error: 'Failed to download PDF',
      };
    }
    
    const pdfBuffer = await fileData.arrayBuffer();
    
    // STAGE 2: Extract text from PDF
    let extractedText: string;
    try {
      extractedText = await extractTextFromPDF(pdfBuffer);
    } catch (error) {
      console.error(`Text extraction failed for ${report.fileName}:`, error);
      return {
        reportType: 'unknown',
        similarityPercentage: null,
        aiPercentage: null,
        extractedText: '',
        error: `Text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
    
    // Normalize text
    const normalizedText = normalizeText(extractedText);
    
    // Check if we got enough text
    if (normalizedText.length <= 30) {
      console.warn(`Insufficient text extracted from ${report.fileName}: ${normalizedText.length} chars`);
      return {
        reportType: 'unknown',
        similarityPercentage: null,
        aiPercentage: null,
        extractedText: normalizedText,
        error: 'Insufficient text extracted from PDF',
      };
    }
    
    // STAGE 3: Classify report type
    const reportType = classifyReport(normalizedText);
    
    // STAGE 4: Extract percentage based on report type
    let similarityPercentage: number | null = null;
    let aiPercentage: number | null = null;
    
    if (reportType === 'similarity') {
      similarityPercentage = extractSimilarityPercentage(normalizedText);
    } else if (reportType === 'ai') {
      aiPercentage = extractAiPercentage(normalizedText);
    }
    
    console.log(`Classified ${report.fileName}: type=${reportType}, similarity=${similarityPercentage}, ai=${aiPercentage}`);
    
    return {
      reportType,
      similarityPercentage,
      aiPercentage,
      extractedText: normalizedText.substring(0, 500), // Keep first 500 chars for debugging
    };
  } catch (error) {
    console.error(`Error processing report ${report.fileName}:`, error);
    return {
      reportType: 'unknown',
      similarityPercentage: null,
      aiPercentage: null,
      extractedText: '',
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

/**
 * Validate all assignments before writing to database.
 * Checks:
 * - Max one AI report per document
 * - Max one Similarity report per document
 * - No report assigned to multiple documents
 * - All reports successfully classified
 */
function performDryRun(
  docsByNormalized: Map<string, any[]>,
  processedReports: Map<string, (ReportFile & ClassificationResult)[]>
): DryRunResult {
  const errors: string[] = [];
  
  for (const [normalized, reports] of processedReports) {
    const matchingDocs = docsByNormalized.get(normalized) || [];
    
    // Skip unmatched reports for validation
    if (matchingDocs.length === 0) continue;
    
    // Multiple documents with same normalized name
    if (matchingDocs.length > 1) {
      errors.push(`Multiple documents match normalized filename "${normalized}"`);
      continue;
    }
    
    const docId = matchingDocs[0].id;
    
    // Count reports by type
    const similarityReports = reports.filter(r => r.reportType === 'similarity');
    const aiReports = reports.filter(r => r.reportType === 'ai');
    const unknownReports = reports.filter(r => r.reportType === 'unknown');
    
    // Validate: max one of each type
    if (similarityReports.length > 1) {
      errors.push(`Document ${docId}: Multiple similarity reports (${similarityReports.length})`);
    }
    if (aiReports.length > 1) {
      errors.push(`Document ${docId}: Multiple AI reports (${aiReports.length})`);
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

    // Verify admin or staff role
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

    console.log(`Processing ${reports.length} reports with raw PDF text extraction`);

    // Fetch all pending/in_progress documents (not needing review)
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
    const docsByNormalized = new Map<string, typeof documents>();
    for (const doc of documents || []) {
      const normalized = doc.normalized_filename || normalizeFilename(doc.file_name);
      if (!docsByNormalized.has(normalized)) {
        docsByNormalized.set(normalized, []);
      }
      docsByNormalized.get(normalized)!.push(doc);
    }

    // Process each report: normalize filename, extract text, classify
    const processedReports = new Map<string, (ReportFile & ClassificationResult)[]>();
    
    for (const report of reports) {
      // STAGE 1: Normalize filename for grouping
      const normalized = normalizeFilename(report.fileName);
      report.normalizedFilename = normalized;
      
      console.log(`Processing report: ${report.fileName} -> normalized: "${normalized}"`);
      
      // STAGES 2-4: Extract text, classify, extract percentage
      const classification = await processReport(supabase, report);
      const processedReport = { ...report, ...classification };
      
      if (!processedReports.has(normalized)) {
        processedReports.set(normalized, []);
      }
      processedReports.get(normalized)!.push(processedReport);
    }

    // STAGE 6: DRY RUN - Validate before writing
    const dryRunResult = performDryRun(docsByNormalized, processedReports);
    console.log(`Dry run: valid=${dryRunResult.valid}, errors=${dryRunResult.errors.length}`);
    if (dryRunResult.errors.length > 0) {
      console.log('Dry run errors:', dryRunResult.errors);
    }

    // Initialize result
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

    // =====================================================
    // STAGE 7 — COMMIT PHASE
    // =====================================================
    
    for (const [normalized, matchingReports] of processedReports) {
      const matchingDocs = docsByNormalized.get(normalized) || [];

      // Case 1: No matching documents -> unmatched
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

      // Case 2: Multiple documents match -> mark for review
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

      // Count reports by type
      const similarityReports = matchingReports.filter(r => r.reportType === 'similarity');
      const aiReports = matchingReports.filter(r => r.reportType === 'ai');
      const unknownReports = matchingReports.filter(r => r.reportType === 'unknown');

      // Check for validation issues
      if (similarityReports.length > 1) {
        issues.push(`Multiple similarity reports (${similarityReports.length})`);
        hasIssues = true;
      }
      if (aiReports.length > 1) {
        issues.push(`Multiple AI reports (${aiReports.length})`);
        hasIssues = true;
      }
      if (unknownReports.length > 0) {
        for (const unknown of unknownReports) {
          issues.push(`Unclassified report: ${unknown.fileName}${unknown.error ? ` (${unknown.error})` : ''}`);
        }
        hasIssues = true;
      }

      // If issues found, mark document for review
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
        
        // Store all reports as unmatched for review
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
        if (report.reportType === 'similarity') {
          // Only assign if no existing similarity report
          if (!doc.similarity_report_path) {
            updateData.similarity_report_path = report.filePath;
            // Only set percentage if not already set
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
          } else {
            // Existing report exists, store as unmatched
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
        } else if (report.reportType === 'ai') {
          // Only assign if no existing AI report
          if (!doc.ai_report_path) {
            updateData.ai_report_path = report.filePath;
            // Only set percentage if not already set
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
          } else {
            // Existing report exists, store as unmatched
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
      }

      // Auto-complete: check if both reports now exist
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

      // Write updates to database
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
        // Create in-app notification
        await supabase.from('user_notifications').insert({
          user_id: completedDoc.user_id,
          title: 'Document Completed',
          message: `Your document "${completedDoc.file_name}" has been processed and is ready for download.`,
          created_by: user.id,
        });

        // Send push notification
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

        // Send completion email
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
