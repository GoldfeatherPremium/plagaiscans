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
 * Extract similarity percentage from PDF
 * Priority: 1) Page 2, 2) Last 20 pages for "ORIGINALITY REPORT" section
 */
async function analyzePdfForSimilarity(pdfBuffer: ArrayBuffer): Promise<{ 
  percentage: number | null; 
  textSnippet: string;
  source: 'page2' | 'originality_report' | 'none';
}> {
  try {
    const pdf = await getDocument({ data: new Uint8Array(pdfBuffer), useSystemFonts: true }).promise;
    
    // Patterns to match similarity percentage on page 2
    const page2Patterns = [
      /(\d+(?:\.\d+)?)\s*%\s*(?:overall\s+)?similarity/i,
      /overall\s*similarity[:\s]*(\d+(?:\.\d+)?)\s*%/i,
      /similarity\s*index[:\s]*(\d+(?:\.\d+)?)\s*%/i,
      /(\d+(?:\.\d+)?)\s*%\s*matching/i,
    ];
    
    // Step 1: Try page 2 first (most common location)
    if (pdf.numPages >= 2) {
      const page = await pdf.getPage(2);
      const textContent = await page.getTextContent();
      // deno-lint-ignore no-explicit-any
      const text = (textContent.items as any[])
        .map((item) => item.str || '')
        .join(' ');
      
      console.log('Page 2 text excerpt:', text.substring(0, 500));
      
      for (const pattern of page2Patterns) {
        const match = text.match(pattern);
        if (match) {
          console.log(`Found similarity on page 2: ${match[1]}%`);
          return { 
            percentage: parseFloat(match[1]), 
            textSnippet: text.substring(0, 200), 
            source: 'page2' 
          };
        }
      }
    }
    
    // Step 2: Scan last 20 pages for "ORIGINALITY REPORT" section
    const lastPageStart = Math.max(1, pdf.numPages - 19); // Last 20 pages
    console.log(`Scanning pages ${lastPageStart} to ${pdf.numPages} for ORIGINALITY REPORT`);
    
    // Patterns for ORIGINALITY REPORT section
    const origPatterns = [
      /(\d+(?:\.\d+)?)\s*%?\s*similarity\s*index/i,
      /similarity\s*index\s*[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    ];
    
    for (let pageNum = pdf.numPages; pageNum >= lastPageStart; pageNum--) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      // deno-lint-ignore no-explicit-any
      const text = (textContent.items as any[])
        .map((item) => item.str || '')
        .join(' ');
      
      // Check for ORIGINALITY REPORT section
      const lowerText = text.toLowerCase();
      if (lowerText.includes('originality report') || lowerText.includes('similarity index')) {
        for (const pattern of origPatterns) {
          const match = text.match(pattern);
          if (match) {
            console.log(`Found similarity on page ${pageNum} (ORIGINALITY REPORT): ${match[1]}%`);
            return { 
              percentage: parseFloat(match[1]), 
              textSnippet: text.substring(0, 200), 
              source: 'originality_report' 
            };
          }
        }
      }
    }
    
    // Step 3: No percentage found
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

    console.log(`Processing ${reports.length} similarity reports with PDF analysis`);

    // Fetch pending/in_progress documents with scan_type = 'similarity_only'
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, normalized_filename, user_id, similarity_report_path, status')
      .eq('scan_type', 'similarity_only')
      .in('status', ['pending', 'in_progress']);

    if (docError) {
      console.error('Error fetching documents:', docError);
      throw new Error('Failed to fetch documents');
    }

    console.log(`Found ${documents?.length || 0} eligible similarity-only documents`);

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
      completedDocuments: [],
      stats: {
        totalReports: reports.length,
        mappedCount: 0,
        unmatchedCount: 0,
        completedCount: 0,
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

      let percentage: number | null = null;
      
      if (downloadError) {
        console.error(`Failed to download PDF ${report.filePath}:`, downloadError);
      } else {
      // Analyze PDF for similarity percentage
        const buffer = await pdfData.arrayBuffer();
        const analysis = await analyzePdfForSimilarity(buffer);
        percentage = analysis.percentage;
        console.log(`Analysis result for ${report.fileName}: percentage=${percentage}, source=${analysis.source}`);
      }

      // Find matching documents
      const matchingDocs = docsByNormalized.get(normalizedFilename) || [];

      // Filter to only documents without a similarity report already
      const docsWithoutReport = matchingDocs.filter(d => !d.similarity_report_path);

      // Case 1: No matching documents at all
      if (matchingDocs.length === 0) {
        result.unmatched.push({
          fileName: report.fileName,
          normalizedFilename,
          filePath: report.filePath,
          reason: 'No matching document found',
        });

        await supabase.from('unmatched_reports').insert({
          file_name: report.fileName,
          normalized_filename: normalizedFilename,
          file_path: report.filePath,
          report_type: 'similarity',
          similarity_percentage: percentage,
          uploaded_by: user.id,
        });
        continue;
      }

      // Case 2: All matching documents already have reports
      if (docsWithoutReport.length === 0) {
        result.unmatched.push({
          fileName: report.fileName,
          normalizedFilename,
          filePath: report.filePath,
          reason: 'All matching documents already have similarity reports',
        });

        await supabase.from('unmatched_reports').insert({
          file_name: report.fileName,
          normalized_filename: normalizedFilename,
          file_path: report.filePath,
          report_type: 'similarity',
          similarity_percentage: percentage,
          uploaded_by: user.id,
        });
        continue;
      }

      // Case 3: Multiple documents without reports - ambiguous
      if (docsWithoutReport.length > 1) {
        result.unmatched.push({
          fileName: report.fileName,
          normalizedFilename,
          filePath: report.filePath,
          reason: `Multiple matching documents without reports (${docsWithoutReport.length}) - ambiguous`,
        });

        await supabase.from('unmatched_reports').insert({
          file_name: report.fileName,
          normalized_filename: normalizedFilename,
          file_path: report.filePath,
          report_type: 'similarity',
          similarity_percentage: percentage,
          uploaded_by: user.id,
          suggested_documents: docsWithoutReport.map(d => ({ id: d.id, file_name: d.file_name })),
        });
        continue;
      }

      // Case 4: Exactly one matching document without a report - perfect match!
      const doc = docsWithoutReport[0];

      // Update document with report - for similarity_only, adding the report completes it
      const updateData: Record<string, unknown> = {
        similarity_report_path: report.filePath,
        status: 'completed',
        completed_at: new Date().toISOString(),
      };
      
      if (percentage !== null) {
        updateData.similarity_percentage = percentage;
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
        percentage,
        success: true,
      });
      result.stats.mappedCount++;
      result.completedDocuments.push(doc.id);
      result.stats.completedCount++;

      // Update local doc reference for subsequent reports
      doc.similarity_report_path = report.filePath;
    }

    // Calculate final stats
    result.stats.unmatchedCount = result.unmatched.length;

    // Send notifications for completed documents
    for (const docId of result.completedDocuments) {
      const { data: completedDoc } = await supabase
        .from('documents')
        .select('id, file_name, user_id')
        .eq('id', docId)
        .single();

      if (completedDoc?.user_id) {
        // Create notification
        await supabase.from('user_notifications').insert({
          user_id: completedDoc.user_id,
          title: 'Similarity Report Ready',
          message: `Your similarity report for "${completedDoc.file_name}" is ready for download.`,
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
              title: 'Similarity Report Ready',
              body: `Your report for "${completedDoc.file_name}" is ready!`,
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
    }

    console.log(`Processing complete: ${result.stats.mappedCount} mapped, ${result.stats.unmatchedCount} unmatched, ${result.stats.completedCount} completed`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-similarity-bulk-reports:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
