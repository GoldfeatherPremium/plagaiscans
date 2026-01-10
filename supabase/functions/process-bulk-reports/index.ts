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
  documentId?: string; // Optional manual assignment from preview
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
}

interface ProcessingResult {
  success: boolean;
  mapped: MappingResult[];
  unmatched: { fileName: string; normalizedFilename: string; filePath: string; reason: string }[];
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

/**
 * Normalize filename for matching:
 * - Remove extension
 * - Remove trailing (1), (2), etc.
 * - Lowercase
 * - Trim whitespace
 */
function normalizeFilename(filename: string): string {
  let result = filename.toLowerCase();
  result = result.replace(/\.[^.]+$/, '');
  result = result.replace(/\s*\(\d+\)$/, '');
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

/**
 * Get document base name (just removes extension)
 */
function getDocumentBaseName(filename: string): string {
  return filename.toLowerCase().replace(/\.[^.]+$/, '').trim();
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

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

/**
 * Calculate similarity percentage between two strings (0-100)
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 100;
  if (a.length === 0 || b.length === 0) return 0;
  
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;
  
  return Math.round(similarity);
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

/**
 * Find best matching document using fuzzy matching
 */
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

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Best match is the highest confidence if unique at that level
  const bestMatch = candidates.length > 0 ? candidates[0] : null;
  
  // Return top 3 suggestions for unmatched reports
  return {
    bestMatch,
    suggestions: candidates.slice(0, 3),
  };
}

/**
 * Analyze PDF page 2 to classify report type and extract percentage
 */
async function analyzePdfPage2(pdfBuffer: ArrayBuffer): Promise<ReportAnalysis> {
  try {
    const pdf = await getDocument({ data: new Uint8Array(pdfBuffer), useSystemFonts: true }).promise;
    
    // Only read page 2 (index 1)
    if (pdf.numPages < 2) {
      console.log('PDF has less than 2 pages, cannot analyze');
      return { reportType: 'unknown', percentage: null, textSnippet: 'insufficient pages' };
    }
    
    const page = await pdf.getPage(2);
    const textContent = await page.getTextContent();
    // deno-lint-ignore no-explicit-any
    const text = (textContent.items as any[])
      .map((item) => item.str || '')
      .join(' ')
      .toLowerCase();
    
    console.log('Page 2 text excerpt:', text.substring(0, 500));
    
    // Enhanced classification keywords
    const similarityKeywords = [
      'overall similarity', 'match groups', 'integrity overview', 'similarity index', 
      'matching text', 'turnitin similarity', 'originality', 'sources overview',
      'internet sources', 'publications', 'student papers'
    ];
    const aiKeywords = [
      'detected as ai', 'ai writing overview', 'detection groups', 'ai-generated', 
      'ai writing detection', 'ai writing', 'human writing', 'chat gpt', 'chatgpt',
      'ai detection', 'ai content'
    ];
    
    const isSimilarity = similarityKeywords.some(kw => text.includes(kw));
    const isAI = aiKeywords.some(kw => text.includes(kw));
    
    let reportType: 'similarity' | 'ai' | 'unknown' = 'unknown';
    let percentage: number | null = null;
    
    if (isSimilarity && !isAI) {
      reportType = 'similarity';
      // Extract similarity percentage - try multiple patterns
      const patterns = [
        /(\d+(?:\.\d+)?)\s*%\s*(?:overall\s+)?similarity/,
        /similarity[:\s]+(\d+(?:\.\d+)?)\s*%/,
        /(\d+(?:\.\d+)?)\s*%\s*match/,
      ];
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          percentage = parseFloat(match[1]);
          break;
        }
      }
    } else if (isAI && !isSimilarity) {
      reportType = 'ai';
      // Extract AI percentage - try multiple patterns
      const patterns = [
        /(\d+(?:\.\d+)?)\s*%\s*(?:detected\s+as\s+)?ai/,
        /ai[:\s]+(\d+(?:\.\d+)?)\s*%/,
        /(\d+(?:\.\d+)?)\s*%\s*ai(?:\s+writing)?/,
      ];
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          percentage = parseFloat(match[1]);
          break;
        }
      }
    } else if (isSimilarity && isAI) {
      // Both keywords found - classify based on which appears first
      const similarityIndex = Math.min(...similarityKeywords.map(kw => {
        const idx = text.indexOf(kw);
        return idx === -1 ? Infinity : idx;
      }));
      const aiIndex = Math.min(...aiKeywords.map(kw => {
        const idx = text.indexOf(kw);
        return idx === -1 ? Infinity : idx;
      }));
      
      if (similarityIndex < aiIndex) {
        reportType = 'similarity';
        const similarityMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:overall\s+)?similarity/);
        if (similarityMatch) percentage = parseFloat(similarityMatch[1]);
      } else {
        reportType = 'ai';
        const aiMatch = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:detected\s+as\s+)?ai/);
        if (aiMatch) percentage = parseFloat(aiMatch[1]);
      }
    }
    
    return { reportType, percentage, textSnippet: text.substring(0, 200) };
  } catch (error) {
    console.error('PDF analysis error:', error);
    return { reportType: 'unknown', percentage: null, textSnippet: 'error: ' + (error as Error).message };
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

    // Verify authorization
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

    // Check role
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

    console.log(`Processing ${reports.length} reports with PDF analysis`);

    // Fetch pending/in_progress documents
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, normalized_filename, user_id, similarity_report_path, ai_report_path, status, needs_review')
      .in('status', ['pending', 'in_progress'])
      .eq('needs_review', false);

    if (docError) {
      console.error('Error fetching documents:', docError);
      throw new Error('Failed to fetch documents');
    }

    console.log(`Found ${documents?.length || 0} eligible documents`);

    // Group documents by normalized filename
    const docsByNormalized = new Map<string, typeof documents>();
    for (const doc of documents || []) {
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

    // Process each report
    for (const report of reports) {
      const normalizedFilename = normalizeFilename(report.fileName);
      console.log(`Processing: ${report.fileName} -> normalized: ${normalizedFilename}`);

      // Download PDF from storage for analysis
      const { data: pdfData, error: downloadError } = await supabase.storage
        .from('reports')
        .download(report.filePath);

      let analysis: ReportAnalysis = { reportType: 'unknown', percentage: null, textSnippet: '' };
      
      if (downloadError) {
        console.error(`Failed to download PDF ${report.filePath}:`, downloadError);
      } else {
        // Analyze PDF page 2
        const buffer = await pdfData.arrayBuffer();
        analysis = await analyzePdfPage2(buffer);
        console.log(`Analysis result for ${report.fileName}:`, analysis);
      }

      // Check for manual assignment first
      let targetDoc: typeof documents[0] | null = null;
      
      if (report.documentId) {
        // Manual assignment from preview - find the document directly
        targetDoc = (documents || []).find(d => d.id === report.documentId) || null;
        if (targetDoc) {
          console.log(`Using manual assignment for ${report.fileName} -> ${targetDoc.file_name}`);
        }
      }

      // If no manual assignment, try exact match then fuzzy match
      if (!targetDoc) {
        // Try exact match first
        const matchingDocs = docsByNormalized.get(normalizedFilename) || [];
        
        if (matchingDocs.length === 1) {
          targetDoc = matchingDocs[0];
        } else if (matchingDocs.length === 0) {
          // Try fuzzy matching
          const { bestMatch, suggestions } = findBestMatch(normalizedFilename, documents || []);
          
          if (bestMatch && bestMatch.confidence >= 90) {
            // High confidence fuzzy match - auto-assign
            targetDoc = bestMatch.doc;
            console.log(`Fuzzy match (${bestMatch.confidence}%) for ${report.fileName} -> ${targetDoc.file_name}`);
          } else {
            // No good match - add to unmatched with suggestions
            result.unmatched.push({
              fileName: report.fileName,
              normalizedFilename,
              filePath: report.filePath,
              reason: bestMatch 
                ? `Best match ${bestMatch.doc.file_name} (${bestMatch.confidence}%) below threshold`
                : 'No matching document found',
            });

            // Store suggestions in unmatched_reports
            await supabase.from('unmatched_reports').insert({
              file_name: report.fileName,
              normalized_filename: normalizedFilename,
              file_path: report.filePath,
              report_type: analysis.reportType === 'unknown' ? null : analysis.reportType,
              uploaded_by: user.id,
              suggested_documents: suggestions.map(s => ({
                id: s.doc.id,
                fileName: s.doc.file_name,
                confidence: s.confidence,
              })),
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
                review_reason: `Multiple documents share normalized filename: ${normalizedFilename}`,
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
          });

          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: normalizedFilename,
            file_path: report.filePath,
            report_type: analysis.reportType === 'unknown' ? null : analysis.reportType,
            uploaded_by: user.id,
          });
          continue;
        }
      }

      // We have a target document
      const doc = targetDoc!;

      // Determine report type from PDF analysis or filename fallback
      let reportType = analysis.reportType;
      if (reportType === 'unknown') {
        // Fallback: if document already has similarity but not AI, assign as AI
        if (doc.similarity_report_path && !doc.ai_report_path) {
          reportType = 'ai';
        } else if (!doc.similarity_report_path) {
          reportType = 'similarity';
        } else {
          // Both slots filled
          result.unmatched.push({
            fileName: report.fileName,
            normalizedFilename,
            filePath: report.filePath,
            reason: 'Document already has both reports',
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

      // Check if slot is available
      if (reportType === 'similarity' && doc.similarity_report_path) {
        // Similarity slot taken, try AI
        if (!doc.ai_report_path) {
          reportType = 'ai';
        } else {
          result.unmatched.push({
            fileName: report.fileName,
            normalizedFilename,
            filePath: report.filePath,
            reason: 'Document already has both reports',
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
        // AI slot taken, try similarity
        if (!doc.similarity_report_path) {
          reportType = 'similarity';
        } else {
          result.unmatched.push({
            fileName: report.fileName,
            normalizedFilename,
            filePath: report.filePath,
            reason: 'Document already has both reports',
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

      // Update document with report
      const updateData: Record<string, unknown> = {};
      
      if (reportType === 'similarity') {
        updateData.similarity_report_path = report.filePath;
        if (analysis.percentage !== null) {
          updateData.similarity_percentage = analysis.percentage;
        }
      } else {
        updateData.ai_report_path = report.filePath;
        if (analysis.percentage !== null) {
          updateData.ai_percentage = analysis.percentage;
        }
      }

      // Check if both reports will be present after this update
      const willHaveSimilarity = reportType === 'similarity' || doc.similarity_report_path;
      const willHaveAI = reportType === 'ai' || doc.ai_report_path;

      if (willHaveSimilarity && willHaveAI) {
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
        result.completedDocuments.push(doc.id);
        result.stats.completedCount++;
        console.log(`Document ${doc.id} completed with both reports`);
      }

      const { error: updateError } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', doc.id);

      if (updateError) {
        console.error(`Error updating document ${doc.id}:`, updateError);
        result.unmatched.push({
          fileName: report.fileName,
          normalizedFilename,
          filePath: report.filePath,
          reason: 'Failed to update document: ' + updateError.message,
        });
        continue;
      }

      result.mapped.push({
        documentId: doc.id,
        fileName: report.fileName,
        reportType: reportType as 'similarity' | 'ai',
        percentage: analysis.percentage,
        success: true,
      });
      result.stats.mappedCount++;

      // Update local doc reference for subsequent reports
      if (reportType === 'similarity') {
        doc.similarity_report_path = report.filePath;
      } else {
        doc.ai_report_path = report.filePath;
      }
    }

    // Calculate final stats
    result.stats.unmatchedCount = result.unmatched.length;
    result.stats.needsReviewCount = result.needsReview.length;

    // Send notifications for completed documents
    for (const docId of result.completedDocuments) {
      const { data: completedDoc } = await supabase
        .from('documents')
        .select('id, file_name, user_id, magic_link_id, similarity_percentage, ai_percentage')
        .eq('id', docId)
        .single();

      if (completedDoc?.user_id) {
        // Create notification
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
        } catch (e) {
          console.error('Push notification failed:', e);
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
        } catch (e) {
          console.error('Completion email failed:', e);
        }
      }

      // Send guest completion email if document has magic_link_id
      if (completedDoc?.magic_link_id) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-guest-completion-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              documentId: docId,
              magicLinkId: completedDoc.magic_link_id,
              fileName: completedDoc.file_name,
              similarityPercentage: completedDoc.similarity_percentage,
              aiPercentage: completedDoc.ai_percentage,
            }),
          });
          console.log('Guest completion email sent for document:', docId);
        } catch (e) {
          console.error('Guest completion email failed:', e);
        }
      }
    }

    console.log('Bulk report processing complete:', result.stats);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-bulk-reports:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
