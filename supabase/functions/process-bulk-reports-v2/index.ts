import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocument } from "https://esm.sh/pdfjs-serverless";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportFile {
  fileName: string;
  filePath: string;
}

interface ReportAnalysis {
  reportType: 'similarity' | 'ai' | 'unknown';
  percentage: number | null;
  textSnippet: string;
}

interface MappingResult {
  documentId: string;
  fileName: string;
  reportType: 'similarity' | 'ai';
  percentage: number | null;
  success: boolean;
  message?: string;
  extractedCoverName?: string | null;
}

interface ProcessingResult {
  success: boolean;
  mapped: MappingResult[];
  unmatched: { fileName: string; normalizedFilename: string; filePath: string; reason: string; extractedCoverName?: string | null }[];
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

function normalizeFilename(filename: string): string {
  let result = filename.toLowerCase();
  result = result.replace(/\.[^.]+$/, '');
  result = result.replace(/\s*\(\d+\)$/, '');
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

function getDocumentBaseName(filename: string): string {
  return filename.toLowerCase().replace(/\.[^.]+$/, '').trim();
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 100;
  if (a.length === 0 || b.length === 0) return 0;
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  return Math.round(((maxLength - distance) / maxLength) * 100);
}

interface MatchCandidate {
  doc: {
    id: string;
    file_name: string;
    normalized_filename: string | null;
    similarity_report_path: string | null;
    ai_report_path: string | null;
    user_id: string | null;
    status: string;
    needs_review: boolean | null;
  };
  confidence: number;
  matchType: 'exact' | 'fuzzy';
}

function findBestMatch(
  normalizedReport: string,
  documents: MatchCandidate['doc'][],
  minConfidence: number = 80
): { bestMatch: MatchCandidate | null; suggestions: MatchCandidate[] } {
  const candidates: MatchCandidate[] = [];
  for (const doc of documents) {
    const docNormalized = doc.normalized_filename || getDocumentBaseName(doc.file_name);
    const similarity = calculateSimilarity(normalizedReport, docNormalized);
    if (similarity >= minConfidence) {
      candidates.push({
        doc,
        confidence: similarity,
        matchType: similarity === 100 ? 'exact' : 'fuzzy',
      });
    }
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  return {
    bestMatch: candidates.length > 0 ? candidates[0] : null,
    suggestions: candidates.slice(0, 3),
  };
}

// deno-lint-ignore no-explicit-any
async function extractPageText(pdf: any, pageNum: number): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const textContent = await page.getTextContent();
  // deno-lint-ignore no-explicit-any
  return (textContent.items as any[]).map((item) => item.str || '').join(' ');
}

/**
 * Extract the original document filename printed on the PDF cover page.
 * Strategy:
 *   1. Look for an explicit label like "Submission Title:", "File Name:", etc.
 *   2. Look for any token ending in a known doc extension (.docx, .pdf, .txt, .rtf, .odt)
 *   3. Fallback: first meaningful non-boilerplate line
 */
function extractDocumentNameFromCoverPage(pageOneText: string, ownPath: string): string | null {
  if (!pageOneText) return null;

  // 1. Explicit label
  const labelRe = /(?:submission\s*(?:title|name)|document\s*(?:title|name)|file\s*name|paper\s*title)\s*[:\-]?\s*([^\n\r|]{1,200}?)(?:\s{2,}|$)/i;
  const labelMatch = pageOneText.match(labelRe);
  if (labelMatch?.[1]) {
    const cleaned = labelMatch[1].trim();
    if (cleaned.length >= 2) return cleaned;
  }

  // 2. Token ending in known extension
  const extRe = /([^\s|]{1,200}\.(?:docx?|pdf|txt|rtf|odt))/gi;
  const ownPathLower = ownPath.toLowerCase();
  const ownBase = ownPath.split('/').pop()?.toLowerCase() ?? '';
  const allExt = [...pageOneText.matchAll(extRe)]
    .map((m) => m[1])
    .filter((name) => {
      const lower = name.toLowerCase();
      return !ownPathLower.includes(lower) && !ownBase.includes(lower);
    });
  if (allExt.length > 0) return allExt[0];

  // 3. First meaningful line
  const lines = pageOneText.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  const skip = /^(turnitin|originality report|similarity report|ai report|page \d+|submitted to|by\s+|\d+\s*%?\s*$)/i;
  const candidate = lines.find((l) => l.length >= 3 && l.length <= 200 && !skip.test(l));
  return candidate ?? null;
}

async function analyzePdf(pdfBuffer: ArrayBuffer): Promise<{ analysis: ReportAnalysis; pdf: any | null }> {
  try {
    const pdf = await getDocument({ data: new Uint8Array(pdfBuffer), useSystemFonts: true }).promise;

    if (pdf.numPages >= 2) {
      const result = await analyzeModernView(pdf);
      if (result.reportType !== 'unknown') return { analysis: result, pdf };
    }
    const classicalResult = await analyzeClassicalView(pdf);
    if (classicalResult.reportType !== 'unknown') return { analysis: classicalResult, pdf };
    const bruteResult = await bruteForceScan(pdf);
    if (bruteResult.reportType !== 'unknown') return { analysis: bruteResult, pdf };

    return { analysis: { reportType: 'unknown', percentage: null, textSnippet: 'no markers found' }, pdf };
  } catch (error) {
    console.error('PDF analysis error:', error);
    return { analysis: { reportType: 'unknown', percentage: null, textSnippet: 'error: ' + (error as Error).message }, pdf: null };
  }
}

// deno-lint-ignore no-explicit-any
async function bruteForceScan(pdf: any): Promise<ReportAnalysis> {
  const simPatterns = [
    /(\d+(?:\.\d+)?)\s*%\s*(?:overall\s+)?similarity/,
    /similarity[:\s]+(\d+(?:\.\d+)?)\s*%/,
    /(\d+(?:\.\d+)?)\s*%\s*similarity\s*index/,
    /similarity\s*index[:\s]*(\d+(?:\.\d+)?)\s*%/,
  ];
  const aiPatterns = [
    /(\d+(?:\.\d+)?)\s*%\s*(?:detected\s+as\s+)?ai/,
    /ai[:\s]+(\d+(?:\.\d+)?)\s*%/,
    /(\d+(?:\.\d+)?)\s*%\s*ai(?:\s+writing)?/,
  ];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const text = (await extractPageText(pdf, pageNum)).toLowerCase();
    for (const p of simPatterns) {
      const m = text.match(p);
      if (m) return { reportType: 'similarity', percentage: parseFloat(m[1]), textSnippet: text.substring(0, 200) };
    }
    for (const p of aiPatterns) {
      const m = text.match(p);
      if (m) return { reportType: 'ai', percentage: parseFloat(m[1]), textSnippet: text.substring(0, 200) };
    }
  }
  return { reportType: 'unknown', percentage: null, textSnippet: '' };
}

// deno-lint-ignore no-explicit-any
async function analyzeModernView(pdf: any): Promise<ReportAnalysis> {
  const rawText = await extractPageText(pdf, 2);
  const text = rawText.toLowerCase();

  const similarityKeywords = [
    'overall similarity', 'match groups', 'integrity overview', 'similarity index',
    'matching text', 'turnitin similarity', 'originality', 'sources overview',
    'internet sources', 'publications', 'student papers',
  ];
  const aiKeywords = [
    'detected as ai', 'ai writing overview', 'detection groups', 'ai-generated',
    'ai writing detection', 'ai writing', 'human writing', 'chat gpt', 'chatgpt',
    'ai detection', 'ai content',
  ];

  const isSimilarity = similarityKeywords.some((kw) => text.includes(kw));
  const isAI = aiKeywords.some((kw) => text.includes(kw));

  let reportType: 'similarity' | 'ai' | 'unknown' = 'unknown';
  let percentage: number | null = null;

  if (isSimilarity && !isAI) {
    reportType = 'similarity';
    percentage = extractSimilarityPercentage(text);
  } else if (isAI && !isSimilarity) {
    reportType = 'ai';
    percentage = extractAIPercentage(text);
  } else if (isSimilarity && isAI) {
    const similarityIndex = Math.min(...similarityKeywords.map((kw) => {
      const idx = text.indexOf(kw); return idx === -1 ? Infinity : idx;
    }));
    const aiIndex = Math.min(...aiKeywords.map((kw) => {
      const idx = text.indexOf(kw); return idx === -1 ? Infinity : idx;
    }));
    if (similarityIndex < aiIndex) {
      reportType = 'similarity';
      percentage = extractSimilarityPercentage(text);
    } else {
      reportType = 'ai';
      percentage = extractAIPercentage(text);
    }
  }

  return { reportType, percentage, textSnippet: text.substring(0, 200) };
}

// deno-lint-ignore no-explicit-any
async function analyzeClassicalView(pdf: any): Promise<ReportAnalysis> {
  const lastPageStart = Math.max(1, pdf.numPages - 9);
  for (let pageNum = pdf.numPages; pageNum >= lastPageStart; pageNum--) {
    const rawText = await extractPageText(pdf, pageNum);
    const text = rawText.toLowerCase();

    const hasOrigReport = text.includes('originality report');
    const hasSimilarityIndex = text.includes('similarity index');
    const hasPrimarySources = text.includes('primary sources');
    const hasInternetSources = text.includes('internet sources');

    if ((hasOrigReport || hasPrimarySources) && (hasSimilarityIndex || hasInternetSources)) {
      const patterns = [
        /(\d+)\s*%\s*similarity\s*index/,
        /similarity\s*index\s*(\d+)\s*%/,
        /similarity\s*index[:\s]*(\d+(?:\.\d+)?)\s*%/,
        /(\d+(?:\.\d+)?)\s*%?\s*similarity\s*index/,
      ];
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          return { reportType: 'similarity', percentage: parseFloat(match[1]), textSnippet: text.substring(0, 200) };
        }
      }
      return { reportType: 'similarity', percentage: null, textSnippet: text.substring(0, 200) };
    }
  }
  return { reportType: 'unknown', percentage: null, textSnippet: '' };
}

function extractSimilarityPercentage(text: string): number | null {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*%\s*(?:overall\s+)?similarity/,
    /similarity[:\s]+(\d+(?:\.\d+)?)\s*%/,
    /(\d+(?:\.\d+)?)\s*%\s*match/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

function extractAIPercentage(text: string): number | null {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*%\s*(?:detected\s+as\s+)?ai/,
    /ai[:\s]+(\d+(?:\.\d+)?)\s*%/,
    /(\d+(?:\.\d+)?)\s*%\s*ai(?:\s+writing)?/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseFloat(match[1]);
  }
  return null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      return new Response(JSON.stringify({ error: 'Forbidden - Admin/Staff only' }), {
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

    console.log(`[V2] Processing ${reports.length} reports with cover-page matching`);

    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, normalized_filename, user_id, similarity_report_path, ai_report_path, status, needs_review')
      .in('status', ['pending', 'in_progress'])
      .eq('needs_review', false);

    if (docError) {
      console.error('Error fetching documents:', docError);
      throw new Error('Failed to fetch documents');
    }

    console.log(`[V2] Found ${documents?.length || 0} eligible documents`);

    const docsByNormalized = new Map<string, typeof documents>();
    for (const doc of documents || []) {
      const normalized = doc.normalized_filename || getDocumentBaseName(doc.file_name);
      if (!docsByNormalized.has(normalized)) docsByNormalized.set(normalized, []);
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

    for (const report of reports) {
      console.log(`[V2] Processing report: ${report.fileName}`);

      // Download PDF
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from('reports')
        .download(report.filePath);

      let analysis: ReportAnalysis = { reportType: 'unknown', percentage: null, textSnippet: '' };
      let extractedCoverName: string | null = null;
      let pdfRef: any = null;

      if (downloadError) {
        console.error(`[V2] Failed to download PDF ${report.filePath}:`, downloadError);
      } else {
        const buffer = await pdfData.arrayBuffer();
        const analyzed = await analyzePdf(buffer);
        analysis = analyzed.analysis;
        pdfRef = analyzed.pdf;

        // Extract cover-page name from page 1
        if (pdfRef && pdfRef.numPages >= 1) {
          try {
            const coverText = await extractPageText(pdfRef, 1);
            extractedCoverName = extractDocumentNameFromCoverPage(coverText, report.filePath);
            console.log(`[V2] ${report.fileName} -> cover name: ${extractedCoverName ?? '(none)'}`);
          } catch (e) {
            console.error(`[V2] Cover-page extraction failed for ${report.fileName}:`, e);
          }
        }
      }

      // Determine match key: cover name first, fall back to filename
      const matchKey = extractedCoverName
        ? normalizeFilename(extractedCoverName)
        : normalizeFilename(report.fileName);
      const normalizedFilename = matchKey;

      console.log(`[V2] ${report.fileName} -> match key: "${normalizedFilename}" (from ${extractedCoverName ? 'cover' : 'filename fallback'})`);

      // Match document
      let targetDoc: typeof documents[0] | null = null;
      const matchingDocs = docsByNormalized.get(normalizedFilename) || [];

      if (matchingDocs.length === 1) {
        targetDoc = matchingDocs[0];
      } else if (matchingDocs.length === 0) {
        // Fuzzy match (V2 uses 85 threshold, vs V1's 90)
        const { bestMatch, suggestions } = findBestMatch(normalizedFilename, documents || [], 80);

        if (bestMatch && bestMatch.confidence >= 85) {
          targetDoc = bestMatch.doc;
          console.log(`[V2] Fuzzy match (${bestMatch.confidence}%) for ${report.fileName} -> ${targetDoc.file_name}`);
        } else {
          result.unmatched.push({
            fileName: report.fileName,
            normalizedFilename,
            filePath: report.filePath,
            reason: bestMatch
              ? `Best match ${bestMatch.doc.file_name} (${bestMatch.confidence}%) below threshold`
              : 'No matching document found',
            extractedCoverName,
          });

          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: normalizedFilename,
            file_path: report.filePath,
            report_type: analysis.reportType === 'unknown' ? null : analysis.reportType,
            uploaded_by: user.id,
            suggested_documents: {
              extracted_cover_name: extractedCoverName,
              source: extractedCoverName ? 'cover_page' : 'filename_fallback',
              candidates: suggestions.map((s) => ({
                id: s.doc.id,
                fileName: s.doc.file_name,
                confidence: s.confidence,
              })),
            },
          });
          continue;
        }
      } else {
        // Multiple exact matches - ambiguous
        for (const doc of matchingDocs) {
          await supabase
            .from('documents')
            .update({
              needs_review: true,
              review_reason: `[V2] Multiple documents share normalized filename: ${normalizedFilename}`,
            })
            .eq('id', doc.id);

          result.needsReview.push({
            documentId: doc.id,
            reason: 'Multiple documents with same normalized filename',
          });
        }

        result.unmatched.push({
          fileName: report.fileName,
          normalizedFilename,
          filePath: report.filePath,
          reason: 'Multiple matching documents - ambiguous',
          extractedCoverName,
        });

        await supabase.from('unmatched_reports').insert({
          file_name: report.fileName,
          normalized_filename: normalizedFilename,
          file_path: report.filePath,
          report_type: analysis.reportType === 'unknown' ? null : analysis.reportType,
          uploaded_by: user.id,
          suggested_documents: {
            extracted_cover_name: extractedCoverName,
            source: extractedCoverName ? 'cover_page' : 'filename_fallback',
          },
        });
        continue;
      }

      const doc = targetDoc!;

      // Determine report type
      let reportType = analysis.reportType;
      if (reportType === 'unknown') {
        if (doc.similarity_report_path && !doc.ai_report_path) {
          reportType = 'ai';
        } else if (!doc.similarity_report_path) {
          reportType = 'similarity';
        } else {
          result.unmatched.push({
            fileName: report.fileName,
            normalizedFilename,
            filePath: report.filePath,
            reason: 'Document already has both reports',
            extractedCoverName,
          });
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: normalizedFilename,
            file_path: report.filePath,
            uploaded_by: user.id,
          });
          continue;
        }
      }

      if (reportType === 'similarity' && doc.similarity_report_path) {
        if (!doc.ai_report_path) {
          reportType = 'ai';
        } else {
          result.unmatched.push({
            fileName: report.fileName,
            normalizedFilename,
            filePath: report.filePath,
            reason: 'Document already has both reports',
            extractedCoverName,
          });
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: normalizedFilename,
            file_path: report.filePath,
            report_type: reportType,
            uploaded_by: user.id,
          });
          continue;
        }
      } else if (reportType === 'ai' && doc.ai_report_path) {
        if (!doc.similarity_report_path) {
          reportType = 'similarity';
        } else {
          result.unmatched.push({
            fileName: report.fileName,
            normalizedFilename,
            filePath: report.filePath,
            reason: 'Document already has both reports',
            extractedCoverName,
          });
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: normalizedFilename,
            file_path: report.filePath,
            report_type: reportType,
            uploaded_by: user.id,
          });
          continue;
        }
      }

      const updateData: Record<string, unknown> = {};
      if (reportType === 'similarity') {
        updateData.similarity_report_path = report.filePath;
        if (analysis.percentage !== null) updateData.similarity_percentage = analysis.percentage;
      } else {
        updateData.ai_report_path = report.filePath;
        if (analysis.percentage !== null) updateData.ai_percentage = analysis.percentage;
      }

      const willHaveSimilarity = reportType === 'similarity' || doc.similarity_report_path;
      const willHaveAI = reportType === 'ai' || doc.ai_report_path;

      if (willHaveSimilarity && willHaveAI) {
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
        console.error(`[V2] Error updating document ${doc.id}:`, updateError);
        result.unmatched.push({
          fileName: report.fileName,
          normalizedFilename,
          filePath: report.filePath,
          reason: 'Failed to update document: ' + updateError.message,
          extractedCoverName,
        });
        continue;
      }

      result.mapped.push({
        documentId: doc.id,
        fileName: report.fileName,
        reportType: reportType as 'similarity' | 'ai',
        percentage: analysis.percentage,
        success: true,
        extractedCoverName,
      });
      result.stats.mappedCount++;

      if (reportType === 'similarity') {
        doc.similarity_report_path = report.filePath;
      } else {
        doc.ai_report_path = report.filePath;
      }
    }

    result.stats.unmatchedCount = result.unmatched.length;
    result.stats.needsReviewCount = result.needsReview.length;

    // Notifications for completed documents
    for (const docId of result.completedDocuments) {
      const { data: completedDoc } = await supabase
        .from('documents')
        .select('id, file_name, user_id, magic_link_id, similarity_percentage, ai_percentage')
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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({
              userId: completedDoc.user_id,
              title: 'Document Completed',
              body: `Your document "${completedDoc.file_name}" is ready!`,
              url: '/my-documents',
            }),
          });
        } catch (e) {
          console.error('[V2] Push notification failed:', e);
        }

        try {
          await fetch(`${supabaseUrl}/functions/v1/send-completion-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({
              documentId: docId,
              userId: completedDoc.user_id,
              fileName: completedDoc.file_name,
            }),
          });
        } catch (e) {
          console.error('[V2] Completion email failed:', e);
        }
      }

      if (completedDoc?.magic_link_id) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-guest-completion-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({
              documentId: docId,
              magicLinkId: completedDoc.magic_link_id,
              fileName: completedDoc.file_name,
              similarityPercentage: completedDoc.similarity_percentage,
              aiPercentage: completedDoc.ai_percentage,
            }),
          });
        } catch (e) {
          console.error('[V2] Guest completion email failed:', e);
        }
      }
    }

    console.log('[V2] Bulk report processing complete:', result.stats);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[V2] Error in process-bulk-reports-v2:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
