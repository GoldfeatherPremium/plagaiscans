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
  // Optional manual override (used in 'apply' phase)
  documentId?: string | null;
  // Optional carry-through analysis from 'analyze' phase (so apply doesn't re-scan)
  reportType?: 'similarity' | 'ai' | 'unknown';
  percentage?: number | null;
  extractedCoverName?: string | null;
}

interface ReportAnalysis {
  reportType: 'similarity' | 'ai' | 'unknown';
  percentage: number | null;
  textSnippet: string;
}

interface MatchSuggestion {
  documentId: string;
  fileName: string;
  normalizedFilename: string;
  confidence: number;
  hasSimilarityReport: boolean;
  hasAIReport: boolean;
  filePath?: string | null;
}

interface AnalysisItem {
  fileName: string;
  filePath: string;
  extractedCoverName: string | null;
  extractionSource: string | null;
  matchKey: string;
  matchSource: 'cover_page' | 'filename_fallback';
  reportType: 'similarity' | 'ai' | 'unknown';
  percentage: number | null;
  bestMatch: MatchSuggestion | null;
  suggestions: MatchSuggestion[];
  autoStatus: 'auto_matched' | 'ambiguous' | 'unmatched' | 'error';
  reason?: string;
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

interface ApplyResult {
  success: boolean;
  mapped: MappingResult[];
  unmatched: { fileName: string; filePath: string; reason: string; extractedCoverName?: string | null }[];
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

interface DocRow {
  id: string;
  file_name: string;
  file_path: string | null;
  normalized_filename: string | null;
  similarity_report_path: string | null;
  ai_report_path: string | null;
  user_id: string | null;
  status: string;
  needs_review: boolean | null;
  magic_link_id?: string | null;
}

function rankCandidates(normalizedReport: string, documents: DocRow[], minConfidence = 60): MatchSuggestion[] {
  const candidates: MatchSuggestion[] = [];
  for (const doc of documents) {
    const docNormalized = doc.normalized_filename || getDocumentBaseName(doc.file_name);
    const confidence = calculateSimilarity(normalizedReport, docNormalized);
    if (confidence >= minConfidence) {
      candidates.push({
        documentId: doc.id,
        fileName: doc.file_name,
        normalizedFilename: docNormalized,
        confidence,
        hasSimilarityReport: !!doc.similarity_report_path,
        hasAIReport: !!doc.ai_report_path,
        filePath: doc.file_path,
      });
    }
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.slice(0, 5);
}

// deno-lint-ignore no-explicit-any
async function extractPageText(pdf: any, pageNum: number): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const textContent = await page.getTextContent();
  // deno-lint-ignore no-explicit-any
  return (textContent.items as any[]).map((item) => item.str || '').join(' ');
}

interface PositionedItem {
  str: string;
  x: number;
  y: number;
  height: number;
  fontName: string;
}

// deno-lint-ignore no-explicit-any
async function extractPositionedItems(pdf: any, pageNum: number): Promise<PositionedItem[]> {
  const page = await pdf.getPage(pageNum);
  const textContent = await page.getTextContent();
  // deno-lint-ignore no-explicit-any
  const items: PositionedItem[] = (textContent.items as any[])
    .map((item) => {
      const str = (item.str || '').toString();
      const tr = item.transform || [1, 0, 0, 1, 0, 0];
      // transform: [scaleX, skewY, skewX, scaleY, x, y]
      return {
        str,
        x: tr[4] ?? 0,
        y: tr[5] ?? 0,
        height: Math.abs(tr[3] ?? item.height ?? 0),
        fontName: item.fontName || '',
      };
    })
    .filter((it) => it.str && it.str.trim().length > 0);
  return items;
}

// Group items into visual lines by Y coordinate, sort top-to-bottom, left-to-right.
function groupIntoLines(items: PositionedItem[]): { y: number; height: number; text: string }[] {
  if (items.length === 0) return [];
  // Sort by y desc (PDF coords: higher y = higher on page), then x asc
  const sorted = [...items].sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lines: { y: number; height: number; items: PositionedItem[] }[] = [];
  for (const it of sorted) {
    const tol = Math.max(2, it.height * 0.5);
    const line = lines.find((l) => Math.abs(l.y - it.y) <= tol);
    if (line) {
      line.items.push(it);
      line.height = Math.max(line.height, it.height);
    } else {
      lines.push({ y: it.y, height: it.height, items: [it] });
    }
  }
  return lines.map((l) => {
    const sortedItems = l.items.sort((a, b) => a.x - b.x);
    // Join with space when there's a noticeable x-gap
    let text = '';
    let prevEnd = -Infinity;
    for (const it of sortedItems) {
      if (text.length > 0 && it.x - prevEnd > it.height * 0.3) text += ' ';
      text += it.str;
      prevEnd = it.x + (it.str.length * it.height * 0.4);
    }
    return { y: l.y, height: l.height, text: text.replace(/\s+/g, ' ').trim() };
  }).filter((l) => l.text.length > 0);
}

const NOISE_RE = /^(turnitin|originality report|similarity report|ai (?:writing )?report|page \d+( of \d+)?( - cover page)?|submitted to|submission(?: id| date)?|download date|file name|file size|word count|character count|document details|by\s+|\d+\s*%?\s*$|cover page)$/i;

function cleanCoverName(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—:]+/, '')
    .replace(/[\s\-–—:]+$/, '')
    .trim();
}

// Heuristics:
// - Modern Turnitin (screenshot 1): title block has 2 lines (student name, then filename).
//   We want the SECOND line (e.g. "Personal Philosophy.pdf"). The "File Name" label
//   below shows an internal id (e.g. "personal-p-...pdf") which must be IGNORED.
// - Classic Turnitin (screenshot 2): large heading at top (may wrap across 2+ lines),
//   followed by "by ...". Take everything before "by".
function extractDocumentNameFromCoverPage(
  lines: { y: number; height: number; text: string }[],
  ownPath: string,
): { name: string | null; source: 'modern_second_line' | 'classic_large_heading' | 'label_fallback' | 'extension_fallback' | null } {
  if (!lines || lines.length === 0) return { name: null, source: null };

  const ownBase = (ownPath.split('/').pop() || '').toLowerCase();

  // Filter out obvious noise lines for the title-block scan
  const visibleLines = lines.filter((l) => !NOISE_RE.test(l.text));

  // Header noise we always want to skip when picking title-block lines
  const HEADER_NOISE = /^(page \d+( of \d+)?( - cover page)?|turnitin|cover page|originality report|similarity report|ai (?:writing )?report)$/i;

  // ---- MODERN VIEW ----
  // Title block sits above "Document Details". Line 1 = student name, Line 2 = filename (what we want).
  const docDetailsIdx = lines.findIndex((l) => /^document\s+details$/i.test(l.text));
  if (docDetailsIdx > 0) {
    const block = lines.slice(0, docDetailsIdx).filter((l) => !HEADER_NOISE.test(l.text));
    if (block.length >= 2) {
      const candidate = cleanCoverName(block[1].text);
      if (candidate.length >= 2 && !NOISE_RE.test(candidate)) {
        return { name: candidate, source: 'modern_second_line' };
      }
    } else if (block.length === 1) {
      const candidate = cleanCoverName(block[0].text);
      if (candidate.length >= 2) return { name: candidate, source: 'modern_second_line' };
    }
  }

  // ---- MODERN VIEW (no anchor) ----
  // If "Document Details" wasn't detected, still prefer line 2 of the cover page,
  // skipping page header noise. This guarantees we never use the first line
  // (which is typically the student name) as the match key.
  const cleanTop = lines.filter((l) => !HEADER_NOISE.test(l.text)).slice(0, 6);
  if (cleanTop.length >= 2) {
    const second = cleanCoverName(cleanTop[1].text);
    // Only accept if it's not obviously noise and looks like a title (not "by ..." etc).
    if (second.length >= 2 && !NOISE_RE.test(second) && !/^by\s+/i.test(second)) {
      return { name: second, source: 'modern_second_line' };
    }
  }

  // ---- CLASSIC VIEW ----
  // Largest font lines at the top, before "by ...".
  const byIdx = visibleLines.findIndex((l) => /^by\s+/i.test(l.text));
  const headPool = byIdx > 0 ? visibleLines.slice(0, byIdx) : visibleLines.slice(0, 6);
  if (headPool.length > 0) {
    const maxHeight = Math.max(...headPool.map((l) => l.height));
    if (maxHeight > 0) {
      // "Large" = within 80% of the max heading size
      const largeLines = headPool.filter((l) => l.height >= maxHeight * 0.8);
      if (largeLines.length > 0) {
        const merged = cleanCoverName(largeLines.map((l) => l.text).join(' '));
        if (merged.length >= 2 && !NOISE_RE.test(merged)) {
          return { name: merged, source: 'classic_large_heading' };
        }
      }
    }
  }

  // ---- LABEL FALLBACK ----
  // Try to read a labelled "Submission Title" / "Paper Title" (NOT "File Name", which is the internal id).
  const allText = lines.map((l) => l.text).join('\n');
  const labelRe = /(?:submission\s*(?:title|name)|document\s*(?:title|name)|paper\s*title)\s*[:\-]?\s*([^\n\r|]{1,200})/i;
  const labelMatch = allText.match(labelRe);
  if (labelMatch?.[1]) {
    const cleaned = cleanCoverName(labelMatch[1]);
    if (cleaned.length >= 2) return { name: cleaned, source: 'label_fallback' };
  }

  // ---- EXTENSION FALLBACK ----
  // Any filename-looking token that isn't our own uploaded path.
  const extRe = /([^\s|/\\]{1,200}\.(?:docx?|pdf|txt|rtf|odt))/gi;
  const allExt = [...allText.matchAll(extRe)]
    .map((m) => m[1])
    .filter((name) => !ownBase.includes(name.toLowerCase()))
    // skip Turnitin internal ids like "personal-p-1777506402829.pdf"
    .filter((name) => !/-p-\d{8,}\.pdf$/i.test(name) && !/^trn[:_-]/i.test(name));
  if (allExt.length > 0) return { name: cleanCoverName(allExt[0]), source: 'extension_fallback' };

  return { name: null, source: null };
}

// deno-lint-ignore no-explicit-any
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
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).single();
    if (!roleData || (roleData.role !== 'admin' && roleData.role !== 'staff')) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin/Staff only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json() as { reports: ReportFile[]; phase?: 'analyze' | 'apply' };
    const phase: 'analyze' | 'apply' = body.phase === 'apply' ? 'apply' : 'analyze';
    const reports = body.reports;

    if (!reports || !Array.isArray(reports) || reports.length === 0) {
      return new Response(JSON.stringify({ error: 'No reports provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[V2] Phase=${phase}, processing ${reports.length} reports`);

    // Fetch eligible documents
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, file_path, normalized_filename, user_id, similarity_report_path, ai_report_path, status, needs_review, magic_link_id')
      .in('status', ['pending', 'in_progress'])
      .eq('needs_review', false);

    if (docError) {
      console.error('Error fetching documents:', docError);
      throw new Error('Failed to fetch documents');
    }
    const docs: DocRow[] = (documents || []) as DocRow[];
    console.log(`[V2] Found ${docs.length} eligible documents`);

    const docsByNormalized = new Map<string, DocRow[]>();
    for (const doc of docs) {
      const normalized = doc.normalized_filename || getDocumentBaseName(doc.file_name);
      if (!docsByNormalized.has(normalized)) docsByNormalized.set(normalized, []);
      docsByNormalized.get(normalized)!.push(doc);
    }

    // ========== PHASE: ANALYZE ==========
    if (phase === 'analyze') {
      const items: AnalysisItem[] = [];

      for (const report of reports) {
        console.log(`[V2/analyze] ${report.fileName}`);

        let analysis: ReportAnalysis = { reportType: 'unknown', percentage: null, textSnippet: '' };
        let extractedCoverName: string | null = null;

        const { data: pdfData, error: downloadError } = await supabase.storage
          .from('reports').download(report.filePath);

        if (downloadError) {
          console.error(`[V2/analyze] Download failed ${report.filePath}:`, downloadError);
          items.push({
            fileName: report.fileName,
            filePath: report.filePath,
            extractedCoverName: null,
            extractionSource: null,
            matchKey: normalizeFilename(report.fileName),
            matchSource: 'filename_fallback',
            reportType: 'unknown',
            percentage: null,
            bestMatch: null,
            suggestions: [],
            autoStatus: 'error',
            reason: 'Failed to download uploaded PDF',
          });
          continue;
        }

        const buffer = await pdfData.arrayBuffer();
        const analyzed = await analyzePdf(buffer);
        analysis = analyzed.analysis;
        const pdfRef = analyzed.pdf;

        let extractionSource: string | null = null;
        if (pdfRef && pdfRef.numPages >= 1) {
          try {
            const items = await extractPositionedItems(pdfRef, 1);
            const lines = groupIntoLines(items);
            const result = extractDocumentNameFromCoverPage(lines, report.filePath);
            extractedCoverName = result.name;
            extractionSource = result.source;
            console.log(`[V2/analyze] Cover extracted: "${extractedCoverName}" via ${extractionSource}`);
          } catch (e) {
            console.error(`[V2/analyze] Cover extraction failed:`, e);
          }
        }

        const matchKey = extractedCoverName
          ? normalizeFilename(extractedCoverName)
          : normalizeFilename(report.fileName);
        const matchSource: 'cover_page' | 'filename_fallback' =
          extractedCoverName ? 'cover_page' : 'filename_fallback';

        // Build suggestions
        const exactMatches = docsByNormalized.get(matchKey) || [];
        let suggestions: MatchSuggestion[] = [];
        if (exactMatches.length > 0) {
          suggestions = exactMatches.map((d) => ({
            documentId: d.id,
            fileName: d.file_name,
            normalizedFilename: d.normalized_filename || getDocumentBaseName(d.file_name),
            confidence: 100,
            hasSimilarityReport: !!d.similarity_report_path,
            hasAIReport: !!d.ai_report_path,
            filePath: (d as any).file_path ?? null,
          }));
          // Add fuzzy matches too
          const fuzzy = rankCandidates(matchKey, docs, 60).filter((s) =>
            !suggestions.some((x) => x.documentId === s.documentId)
          );
          suggestions = [...suggestions, ...fuzzy].slice(0, 5);
        } else {
          suggestions = rankCandidates(matchKey, docs, 60);
        }

        let bestMatch: MatchSuggestion | null = null;
        let autoStatus: AnalysisItem['autoStatus'] = 'unmatched';
        let reason: string | undefined;

        if (exactMatches.length === 1) {
          bestMatch = suggestions[0];
          autoStatus = 'auto_matched';
        } else if (exactMatches.length > 1) {
          bestMatch = suggestions[0];
          autoStatus = 'ambiguous';
          reason = `${exactMatches.length} documents share this name`;
        } else if (suggestions.length > 0 && suggestions[0].confidence >= 85) {
          bestMatch = suggestions[0];
          autoStatus = 'auto_matched';
        } else if (suggestions.length > 0) {
          bestMatch = suggestions[0];
          autoStatus = 'unmatched';
          reason = `Best candidate ${suggestions[0].confidence}% below threshold`;
        } else {
          autoStatus = 'unmatched';
          reason = 'No candidates found';
        }

        items.push({
          fileName: report.fileName,
          filePath: report.filePath,
          extractedCoverName,
          extractionSource,
          matchKey,
          matchSource,
          reportType: analysis.reportType,
          percentage: analysis.percentage,
          bestMatch,
          suggestions,
          autoStatus,
          reason,
        });
      }

      return new Response(JSON.stringify({ phase: 'analyze', items }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== PHASE: APPLY ==========
    const result: ApplyResult = {
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
      // In apply phase, we trust the carry-through analysis from the client
      // (already scanned during analyze). If missing, re-scan.
      let reportType: 'similarity' | 'ai' | 'unknown' = report.reportType ?? 'unknown';
      let percentage: number | null = report.percentage ?? null;
      const extractedCoverName: string | null = report.extractedCoverName ?? null;

      if (reportType === 'unknown' || percentage === null) {
        const { data: pdfData, error: downloadError } = await supabase.storage
          .from('reports').download(report.filePath);
        if (!downloadError) {
          const buffer = await pdfData.arrayBuffer();
          const analyzed = await analyzePdf(buffer);
          if (reportType === 'unknown') reportType = analyzed.analysis.reportType;
          if (percentage === null) percentage = analyzed.analysis.percentage;
        }
      }

      const matchKey = extractedCoverName
        ? normalizeFilename(extractedCoverName)
        : normalizeFilename(report.fileName);

      // Resolve target document: manual override first, then exact, then fuzzy
      let targetDoc: DocRow | null = null;

      if (report.documentId) {
        targetDoc = docs.find((d) => d.id === report.documentId) ?? null;
        if (!targetDoc) {
          // Document might exist but not in eligible set; fetch directly
          const { data: directDoc } = await supabase
            .from('documents')
            .select('id, file_name, file_path, normalized_filename, user_id, similarity_report_path, ai_report_path, status, needs_review, magic_link_id')
            .eq('id', report.documentId)
            .maybeSingle();
          targetDoc = (directDoc as DocRow) ?? null;
        }
      } else {
        const matchingDocs = docsByNormalized.get(matchKey) || [];
        if (matchingDocs.length === 1) {
          targetDoc = matchingDocs[0];
        } else if (matchingDocs.length === 0) {
          const suggestions = rankCandidates(matchKey, docs, 60);
          if (suggestions.length > 0 && suggestions[0].confidence >= 85) {
            targetDoc = docs.find((d) => d.id === suggestions[0].documentId) ?? null;
          }
        }
      }

      if (!targetDoc) {
        result.unmatched.push({
          fileName: report.fileName,
          filePath: report.filePath,
          reason: 'No target document selected and no auto-match found',
          extractedCoverName,
        });
        await supabase.from('unmatched_reports').insert({
          file_name: report.fileName,
          normalized_filename: matchKey,
          file_path: report.filePath,
          report_type: reportType === 'unknown' ? null : reportType,
          uploaded_by: user.id,
          suggested_documents: { extracted_cover_name: extractedCoverName },
        });
        continue;
      }

      // Determine final report type
      let finalType = reportType;
      if (finalType === 'unknown') {
        if (targetDoc.similarity_report_path && !targetDoc.ai_report_path) finalType = 'ai';
        else if (!targetDoc.similarity_report_path) finalType = 'similarity';
        else {
          result.unmatched.push({
            fileName: report.fileName, filePath: report.filePath,
            reason: 'Document already has both reports', extractedCoverName,
          });
          continue;
        }
      }
      if (finalType === 'similarity' && targetDoc.similarity_report_path) {
        if (!targetDoc.ai_report_path) finalType = 'ai';
        else {
          result.unmatched.push({
            fileName: report.fileName, filePath: report.filePath,
            reason: 'Document already has both reports', extractedCoverName,
          });
          continue;
        }
      } else if (finalType === 'ai' && targetDoc.ai_report_path) {
        if (!targetDoc.similarity_report_path) finalType = 'similarity';
        else {
          result.unmatched.push({
            fileName: report.fileName, filePath: report.filePath,
            reason: 'Document already has both reports', extractedCoverName,
          });
          continue;
        }
      }

      const updateData: Record<string, unknown> = {};
      if (finalType === 'similarity') {
        updateData.similarity_report_path = report.filePath;
        if (percentage !== null) updateData.similarity_percentage = percentage;
      } else {
        updateData.ai_report_path = report.filePath;
        if (percentage !== null) updateData.ai_percentage = percentage;
      }

      const willHaveSimilarity = finalType === 'similarity' || targetDoc.similarity_report_path;
      const willHaveAI = finalType === 'ai' || targetDoc.ai_report_path;

      if (willHaveSimilarity && willHaveAI) {
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
        result.completedDocuments.push(targetDoc.id);
        result.stats.completedCount++;
      }

      const { error: updateError } = await supabase
        .from('documents').update(updateData).eq('id', targetDoc.id);

      if (updateError) {
        console.error(`[V2/apply] Update failed ${targetDoc.id}:`, updateError);
        result.unmatched.push({
          fileName: report.fileName, filePath: report.filePath,
          reason: 'Failed to update document: ' + updateError.message,
          extractedCoverName,
        });
        continue;
      }

      result.mapped.push({
        documentId: targetDoc.id,
        fileName: report.fileName,
        reportType: finalType as 'similarity' | 'ai',
        percentage,
        success: true,
        extractedCoverName,
      });
      result.stats.mappedCount++;

      if (finalType === 'similarity') targetDoc.similarity_report_path = report.filePath;
      else targetDoc.ai_report_path = report.filePath;
    }

    result.stats.unmatchedCount = result.unmatched.length;
    result.stats.needsReviewCount = result.needsReview.length;

    // Notifications for completed documents
    for (const docId of result.completedDocuments) {
      const { data: completedDoc } = await supabase
        .from('documents')
        .select('id, file_name, user_id, magic_link_id, similarity_percentage, ai_percentage')
        .eq('id', docId).single();

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
        } catch (e) { console.error('[V2] Push failed:', e); }
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
        } catch (e) { console.error('[V2] Email failed:', e); }
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
        } catch (e) { console.error('[V2] Guest email failed:', e); }
      }
    }

    console.log('[V2/apply] Complete:', result.stats);

    return new Response(JSON.stringify({ phase: 'apply', ...result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[V2] Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
