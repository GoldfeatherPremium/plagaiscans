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
  documentId?: string;
}

interface MappingResult {
  documentId: string;
  fileName: string;
  percentage: number | null;
  success: boolean;
  message?: string;
}

interface ProcessingResult {
  success: boolean;
  mapped: MappingResult[];
  unmatched: { fileName: string; normalizedFilename: string; filePath: string; reason: string }[];
  completedDocuments: string[];
  stats: {
    totalReports: number;
    mappedCount: number;
    unmatchedCount: number;
    completedCount: number;
  };
}

function normalizeFilename(filename: string): string {
  let result = filename.toLowerCase();
  result = result.replace(/\.(pdf|docx?|xlsx?|pptx?|txt|rtf)$/gi, '');
  result = result.replace(/\.(pdf|docx?|xlsx?|pptx?|txt|rtf)$/gi, '');
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
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
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

interface DocRecord {
  id: string;
  file_name: string;
  normalized_filename: string | null;
  user_id: string | null;
  magic_link_id: string | null;
  similarity_report_path: string | null;
  status: string;
}

interface MatchCandidate {
  doc: DocRecord;
  confidence: number;
}

function findBestMatch(
  normalizedReport: string,
  documents: DocRecord[],
  minConfidence = 80
): { bestMatch: MatchCandidate | null; suggestions: MatchCandidate[] } {
  const candidates: MatchCandidate[] = [];
  for (const doc of documents) {
    const docNormalized = doc.normalized_filename || getDocumentBaseName(doc.file_name);
    const similarity = calculateSimilarity(normalizedReport, docNormalized);
    if (similarity >= minConfidence) {
      candidates.push({ doc, confidence: similarity });
    }
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  return {
    bestMatch: candidates.length > 0 ? candidates[0] : null,
    suggestions: candidates.slice(0, 3),
  };
}

async function analyzePdfForSimilarity(pdfBuffer: ArrayBuffer): Promise<{
  percentage: number | null;
  textSnippet: string;
  source: 'page2' | 'originality_report' | 'none';
}> {
  try {
    const pdf = await getDocument({ data: new Uint8Array(pdfBuffer), useSystemFonts: true }).promise;

    const page2Patterns = [
      /(\d+(?:\.\d+)?)\s*%\s*(?:overall\s+)?similarity/i,
      /overall\s*similarity[:\s]*(\d+(?:\.\d+)?)\s*%/i,
      /similarity\s*index[:\s]*(\d+(?:\.\d+)?)\s*%/i,
      /(\d+(?:\.\d+)?)\s*%\s*matching/i,
    ];

    if (pdf.numPages >= 2) {
      const page = await pdf.getPage(2);
      const textContent = await page.getTextContent();
      // deno-lint-ignore no-explicit-any
      const text = (textContent.items as any[]).map((item) => item.str || '').join(' ');
      console.log('Page 2 text excerpt:', text.substring(0, 500));
      for (const pattern of page2Patterns) {
        const match = text.match(pattern);
        if (match) {
          console.log(`Found similarity on page 2: ${match[1]}%`);
          return { percentage: parseFloat(match[1]), textSnippet: text.substring(0, 200), source: 'page2' };
        }
      }
    }

    const lastPageStart = Math.max(1, pdf.numPages - 19);
    const origPatterns = [
      /(\d+(?:\.\d+)?)\s*%?\s*similarity\s*index/i,
      /similarity\s*index\s*[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    ];
    for (let pageNum = pdf.numPages; pageNum >= lastPageStart; pageNum--) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      // deno-lint-ignore no-explicit-any
      const text = (textContent.items as any[]).map((item) => item.str || '').join(' ');
      const lowerText = text.toLowerCase();
      if (lowerText.includes('originality report') || lowerText.includes('similarity index')) {
        for (const pattern of origPatterns) {
          const match = text.match(pattern);
          if (match) {
            console.log(`Found similarity on page ${pageNum} (ORIGINALITY REPORT): ${match[1]}%`);
            return { percentage: parseFloat(match[1]), textSnippet: text.substring(0, 200), source: 'originality_report' };
          }
        }
      }
    }

    console.log('No similarity percentage found in PDF');
    return { percentage: null, textSnippet: 'no percentage found', source: 'none' };
  } catch (error) {
    console.error('PDF analysis error:', error);
    return { percentage: null, textSnippet: 'error: ' + (error as Error).message, source: 'none' };
  }
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

    const { reports } = await req.json() as { reports: ReportFile[] };
    if (!reports || !Array.isArray(reports) || reports.length === 0) {
      return new Response(JSON.stringify({ error: 'No reports provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${reports.length} similarity reports with PDF analysis`);

    // Fetch eligible documents — filter deleted and needs_review
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, normalized_filename, user_id, magic_link_id, similarity_report_path, status')
      .eq('scan_type', 'similarity_only')
      .in('status', ['pending', 'in_progress'])
      .eq('needs_review', false)
      .is('deleted_at', null);

    if (docError) {
      console.error('Error fetching documents:', docError);
      throw new Error('Failed to fetch documents');
    }

    console.log(`Found ${documents?.length || 0} eligible similarity-only documents`);

    // Group documents by normalized filename
    const docsByNormalized = new Map<string, DocRecord[]>();
    for (const doc of (documents || []) as DocRecord[]) {
      const normalized = doc.normalized_filename || getDocumentBaseName(doc.file_name);
      if (!docsByNormalized.has(normalized)) {
        docsByNormalized.set(normalized, []);
      }
      docsByNormalized.get(normalized)!.push(doc);
    }

    const result: ProcessingResult = {
      success: true,
      mapped: [],
      unmatched: [],
      completedDocuments: [],
      stats: { totalReports: reports.length, mappedCount: 0, unmatchedCount: 0, completedCount: 0 },
    };

    for (const report of reports) {
      const normalizedFilename = normalizeFilename(report.fileName);
      console.log(`Processing: ${report.fileName} -> normalized: ${normalizedFilename}`);

      // Download and analyze PDF
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from('reports').download(report.filePath);

      let percentage: number | null = null;
      if (downloadError) {
        console.error(`Failed to download PDF ${report.filePath}:`, downloadError);
      } else {
        const buffer = await pdfData.arrayBuffer();
        const analysis = await analyzePdfForSimilarity(buffer);
        percentage = analysis.percentage;
        console.log(`Analysis result for ${report.fileName}: percentage=${percentage}, source=${analysis.source}`);
      }

      // Step 1: Check for manual assignment
      let targetDoc: DocRecord | null = null;

      if (report.documentId) {
        targetDoc = ((documents || []) as DocRecord[]).find(d => d.id === report.documentId) || null;
        if (targetDoc) {
          console.log(`Using manual assignment for ${report.fileName} -> ${targetDoc.file_name}`);
        }
      }

      // Step 2: Try exact match then fuzzy match
      if (!targetDoc) {
        const matchingDocs = docsByNormalized.get(normalizedFilename) || [];
        const docsWithoutReport = matchingDocs.filter(d => !d.similarity_report_path);

        if (docsWithoutReport.length === 1) {
          targetDoc = docsWithoutReport[0];
        } else if (docsWithoutReport.length === 0 && matchingDocs.length === 0) {
          // No exact match — try fuzzy
          const allDocs = ((documents || []) as DocRecord[]).filter(d => !d.similarity_report_path);
          const { bestMatch, suggestions } = findBestMatch(normalizedFilename, allDocs);

          if (bestMatch && bestMatch.confidence >= 90) {
            targetDoc = bestMatch.doc;
            console.log(`Fuzzy match (${bestMatch.confidence}%) for ${report.fileName} -> ${targetDoc.file_name}`);
          } else {
            result.unmatched.push({
              fileName: report.fileName, normalizedFilename, filePath: report.filePath,
              reason: bestMatch
                ? `Best match ${bestMatch.doc.file_name} (${bestMatch.confidence}%) below threshold`
                : 'No matching document found',
            });
            await supabase.from('unmatched_reports').insert({
              file_name: report.fileName, normalized_filename: normalizedFilename,
              file_path: report.filePath, report_type: 'similarity',
              similarity_percentage: percentage, uploaded_by: user.id,
              suggested_documents: suggestions.map(s => ({ id: s.doc.id, fileName: s.doc.file_name, confidence: s.confidence })),
            });
            continue;
          }
        } else if (docsWithoutReport.length > 1) {
          result.unmatched.push({
            fileName: report.fileName, normalizedFilename, filePath: report.filePath,
            reason: `Multiple matching documents without reports (${docsWithoutReport.length}) - ambiguous`,
          });
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName, normalized_filename: normalizedFilename,
            file_path: report.filePath, report_type: 'similarity',
            similarity_percentage: percentage, uploaded_by: user.id,
            suggested_documents: docsWithoutReport.map(d => ({ id: d.id, file_name: d.file_name })),
          });
          continue;
        } else {
          // All matching docs already have reports
          result.unmatched.push({
            fileName: report.fileName, normalizedFilename, filePath: report.filePath,
            reason: 'All matching documents already have similarity reports',
          });
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName, normalized_filename: normalizedFilename,
            file_path: report.filePath, report_type: 'similarity',
            similarity_percentage: percentage, uploaded_by: user.id,
          });
          continue;
        }
      }

      // We have a target — update document
      const doc = targetDoc!;
      const updateData: Record<string, unknown> = {
        similarity_report_path: report.filePath,
        status: 'completed',
        completed_at: new Date().toISOString(),
      };
      if (percentage !== null) {
        updateData.similarity_percentage = percentage;
      }

      const { error: updateError } = await supabase
        .from('documents').update(updateData).eq('id', doc.id);

      if (updateError) {
        console.error(`Error updating document ${doc.id}:`, updateError);
        result.unmatched.push({
          fileName: report.fileName, normalizedFilename, filePath: report.filePath,
          reason: 'Failed to update document: ' + updateError.message,
        });
        continue;
      }

      result.mapped.push({ documentId: doc.id, fileName: report.fileName, percentage, success: true });
      result.stats.mappedCount++;
      result.completedDocuments.push(doc.id);
      result.stats.completedCount++;

      // Update local reference to prevent double-assignment
      doc.similarity_report_path = report.filePath;
    }

    result.stats.unmatchedCount = result.unmatched.length;

    // Send notifications for completed documents
    for (const docId of result.completedDocuments) {
      const { data: completedDoc } = await supabase
        .from('documents')
        .select('id, file_name, user_id, magic_link_id, similarity_percentage')
        .eq('id', docId).single();

      if (completedDoc?.user_id) {
        await supabase.from('user_notifications').insert({
          user_id: completedDoc.user_id,
          title: 'Similarity Report Ready',
          message: `Your similarity report for "${completedDoc.file_name}" is ready for download.`,
          created_by: user.id,
        });

        try {
          await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({
              userId: completedDoc.user_id,
              title: 'Similarity Report Ready',
              body: `Your report for "${completedDoc.file_name}" is ready!`,
              url: '/my-documents',
            }),
          });
        } catch (e) {
          console.error('Push notification failed:', e);
        }

        try {
          await fetch(`${supabaseUrl}/functions/v1/send-completion-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({
              documentId: docId, userId: completedDoc.user_id, fileName: completedDoc.file_name,
            }),
          });
        } catch (e) {
          console.error('Completion email failed:', e);
        }
      }

      // Guest completion email
      if (completedDoc?.magic_link_id) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-guest-completion-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({
              documentId: docId, magicLinkId: completedDoc.magic_link_id,
              fileName: completedDoc.file_name, similarityPercentage: completedDoc.similarity_percentage,
            }),
          });
          console.log('Guest completion email sent for document:', docId);
        } catch (e) {
          console.error('Guest completion email failed:', e);
        }
      }
    }

    console.log(`Processing complete: ${result.stats.mappedCount} mapped, ${result.stats.unmatchedCount} unmatched, ${result.stats.completedCount} completed`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in process-similarity-bulk-reports:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
