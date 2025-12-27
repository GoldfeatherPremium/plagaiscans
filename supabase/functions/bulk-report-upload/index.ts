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

interface ReportClassification {
  type: 'ai' | 'similarity' | 'unknown';
  percentage: number | null;
}

interface ClassifiedReport extends ReportFile {
  classification: ReportClassification;
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
  unmatched: (ReportFile & { classification?: ReportClassification })[];
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
 * Normalize filename for CUSTOMER documents (base name).
 * Just removes the file extension, keeps everything else including brackets.
 * Examples:
 *   fileA1.pdf → fileA1
 *   fileA1 (1).pdf → fileA1 (1)
 *   FYP_proposal.pdf → fyp_proposal
 */
function getDocumentBaseName(filename: string): string {
  let result = filename.toLowerCase();
  // Remove file extension only
  result = result.replace(/\.[^.]+$/, '');
  // Handle double dots (e.g., "file..pdf" → "file")
  result = result.replace(/\.+$/, '');
  return result.trim();
}

/**
 * Normalize filename for REPORT files (admin-uploaded).
 * Removes extension AND trailing report suffixes like _1, _-1, _2, (1), (2), etc.
 * 
 * Examples:
 *   FYP_proposal_1.pdf → fyp_proposal (AI report for "FYP_proposal.pdf")
 *   FYP_proposal.pdf → fyp_proposal (Similarity report for "FYP_proposal.pdf")
 *   fileA1 (1).pdf → fileA1 (report for "fileA1.pdf")
 *   fileA1 (1) (2).pdf → fileA1 (1) (report for "fileA1 (1).pdf")
 *   DOC-20251227-WA0000._1.pdf → doc-20251227-wa0000. (handles underscore suffix)
 *   DOC-20251227-WA0000..pdf → doc-20251227-wa0000. (handles double dot)
 */
function normalizeReportFilename(filename: string): string {
  let result = filename.toLowerCase();
  // Remove file extension
  result = result.replace(/\.[^.]+$/, '');
  // Handle double dots at the end (e.g., "file..pdf" after extension removal leaves "file.")
  // Keep one dot if there are multiples for matching purposes
  result = result.replace(/\.+$/, '.');
  // Remove trailing underscore suffixes: _1, _-1, _2, etc.
  result = result.replace(/_-?\d+$/, '');
  // Remove trailing bracket suffixes: (1), (2), etc.
  result = result.replace(/\s*\(\d+\)$/, '');
  // Clean up trailing dots that may remain
  result = result.replace(/\.+$/, '');
  return result.trim();
}

/**
 * Extract text from page 2 of a PDF stored in Supabase storage.
 * Uses a simple text extraction approach for Deno environment.
 */
async function extractPage2Text(supabase: any, filePath: string): Promise<string> {
  try {
    console.log(`Downloading PDF for text extraction: ${filePath}`);
    
    const { data, error } = await supabase.storage
      .from('reports')
      .download(filePath);
    
    if (error || !data) {
      console.error('Failed to download PDF:', error);
      return '';
    }

    // Convert blob to array buffer
    const arrayBuffer = await data.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Simple PDF text extraction - look for text streams
    // This is a basic approach that works for most PDFs
    const text = extractTextFromPDF(uint8Array);
    
    console.log(`Extracted ${text.length} characters from PDF`);
    return text;
  } catch (err) {
    console.error('Error extracting PDF text:', err);
    return '';
  }
}

/**
 * Basic PDF text extraction that looks for text content.
 * Focuses on extracting text that would appear on page 2.
 */
function extractTextFromPDF(pdfData: Uint8Array): string {
  // Convert to string to search for text patterns
  const decoder = new TextDecoder('latin1');
  const pdfString = decoder.decode(pdfData);
  
  // Look for text between BT (Begin Text) and ET (End Text) markers
  const textParts: string[] = [];
  
  // Also look for parenthesized strings which contain actual text content
  const textMatches = pdfString.matchAll(/\(([^)]+)\)/g);
  for (const match of textMatches) {
    const text = match[1]
      // Handle PDF escape sequences
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
    
    // Filter out binary/garbage content
    if (text.length > 2 && /[a-zA-Z0-9%]/.test(text)) {
      textParts.push(text);
    }
  }
  
  // Join all extracted text
  const fullText = textParts.join(' ');
  
  // Log a sample for debugging
  if (fullText.length > 0) {
    console.log('Sample extracted text:', fullText.substring(0, 500));
  }
  
  return fullText;
}

/**
 * Classify a report based on page 2 content.
 * Returns the type (AI or Similarity) and extracted percentage.
 */
function classifyReport(pdfText: string): ReportClassification {
  const text = pdfText.toLowerCase();
  
  // Check for AI report indicators
  // Common patterns: "% detected as AI", "AI Writing Overview", "detected as ai-generated"
  const aiPatterns = [
    /(\d+)\s*%\s*detected\s+as\s+ai/i,
    /(\d+)\s*%\s*ai/i,
    /ai\s*writing[^%]*?(\d+)\s*%/i,
    /(\d+)\s*%[^%]*?ai[- ]?generated/i,
    /ai[- ]?detection[^%]*?(\d+)\s*%/i,
  ];
  
  for (const pattern of aiPatterns) {
    const match = pdfText.match(pattern);
    if (match) {
      const percentage = parseInt(match[1], 10);
      console.log(`Classified as AI report with ${percentage}%`);
      return { type: 'ai', percentage };
    }
  }
  
  // Check for "AI Writing Overview" or similar headers without percentage in same pattern
  if (text.includes('ai writing') || text.includes('ai-generated') || 
      text.includes('ai detection') || text.includes('detected as ai')) {
    // Try to find any percentage nearby
    const percentMatch = pdfText.match(/(\d+)\s*%/);
    if (percentMatch) {
      const percentage = parseInt(percentMatch[1], 10);
      console.log(`Classified as AI report (header match) with ${percentage}%`);
      return { type: 'ai', percentage };
    }
    console.log('Classified as AI report (no percentage found)');
    return { type: 'ai', percentage: null };
  }
  
  // Check for Similarity report indicators
  // Common patterns: "% Overall Similarity", "Integrity Overview", "Similarity Report"
  const similarityPatterns = [
    /(\d+)\s*%\s*overall\s+similarity/i,
    /overall\s+similarity[^%]*?(\d+)\s*%/i,
    /(\d+)\s*%\s*similarity/i,
    /similarity[^%]*?(\d+)\s*%/i,
    /integrity[^%]*?(\d+)\s*%/i,
  ];
  
  for (const pattern of similarityPatterns) {
    const match = pdfText.match(pattern);
    if (match) {
      const percentage = parseInt(match[1], 10);
      console.log(`Classified as Similarity report with ${percentage}%`);
      return { type: 'similarity', percentage };
    }
  }
  
  // Check for "Integrity Overview" or similar headers
  if (text.includes('integrity') || text.includes('similarity') || 
      text.includes('plagiarism') || text.includes('originality')) {
    // Try to find any percentage nearby
    const percentMatch = pdfText.match(/(\d+)\s*%/);
    if (percentMatch) {
      const percentage = parseInt(percentMatch[1], 10);
      console.log(`Classified as Similarity report (header match) with ${percentage}%`);
      return { type: 'similarity', percentage };
    }
    console.log('Classified as Similarity report (no percentage found)');
    return { type: 'similarity', percentage: null };
  }
  
  // Fallback: try to infer from filename suffix patterns if text extraction failed
  console.log('Could not classify report from text content');
  return { type: 'unknown', percentage: null };
}

/**
 * Fallback classification based on filename patterns.
 * _1 suffix typically indicates AI report, no suffix or _-1 indicates Similarity.
 */
function classifyByFilename(filename: string): ReportClassification {
  const lower = filename.toLowerCase();
  
  // Remove extension first
  const nameWithoutExt = lower.replace(/\.[^.]+$/, '');
  
  // Check for _1 suffix (AI report pattern)
  if (/_1$/.test(nameWithoutExt) || /_\d+$/.test(nameWithoutExt)) {
    console.log(`Filename pattern suggests AI report: ${filename}`);
    return { type: 'ai', percentage: null };
  }
  
  // Check for _-1 suffix (Similarity report pattern)
  if (/_-1$/.test(nameWithoutExt) || /_-\d+$/.test(nameWithoutExt)) {
    console.log(`Filename pattern suggests Similarity report: ${filename}`);
    return { type: 'similarity', percentage: null };
  }
  
  // No suffix - default to similarity (first report)
  console.log(`No filename pattern, defaulting to Similarity: ${filename}`);
  return { type: 'similarity', percentage: null };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
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

    console.log(`Processing ${reports.length} reports for auto-mapping with classification`);

    // Step 1: Classify all reports by reading page 2
    const classifiedReports: ClassifiedReport[] = [];
    
    for (const report of reports) {
      console.log(`\n--- Classifying: ${report.fileName} ---`);
      
      // Extract text from PDF
      const pdfText = await extractPage2Text(supabase, report.filePath);
      
      // Classify based on content
      let classification = classifyReport(pdfText);
      
      // If content classification failed, fall back to filename pattern
      if (classification.type === 'unknown') {
        classification = classifyByFilename(report.fileName);
      }
      
      // Normalize the filename for matching
      const normalizedFilename = normalizeReportFilename(report.fileName);
      
      classifiedReports.push({
        ...report,
        normalizedFilename,
        classification,
      });
      
      console.log(`Report "${report.fileName}" → normalized: "${normalizedFilename}", type: ${classification.type}, percentage: ${classification.percentage}`);
    }

    // Step 2: Fetch all pending and in_progress documents
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, normalized_filename, user_id, similarity_report_path, ai_report_path, similarity_percentage, ai_percentage, status, needs_review')
      .in('status', ['pending', 'in_progress']);

    if (docError) {
      console.error('Error fetching documents:', docError);
      throw new Error('Failed to fetch documents');
    }

    console.log(`\nFound ${documents?.length || 0} pending/in_progress documents`);

    // Step 3: Group documents by their BASE NAME
    const docsByBaseName = new Map<string, typeof documents>();
    for (const doc of documents || []) {
      const baseName = doc.normalized_filename || getDocumentBaseName(doc.file_name);
      
      if (!docsByBaseName.has(baseName)) {
        docsByBaseName.set(baseName, []);
      }
      docsByBaseName.get(baseName)!.push(doc);
    }

    console.log('Document base names:', Array.from(docsByBaseName.keys()));

    // Step 4: Group classified reports by their normalized filename
    const reportsByNormalized = new Map<string, ClassifiedReport[]>();
    for (const report of classifiedReports) {
      const normalized = report.normalizedFilename;
      
      if (!reportsByNormalized.has(normalized)) {
        reportsByNormalized.set(normalized, []);
      }
      reportsByNormalized.get(normalized)!.push(report);
    }

    console.log('Report normalized names:', Array.from(reportsByNormalized.keys()));

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

    // Step 5: Process each group of reports
    for (const [normalized, matchingReports] of reportsByNormalized) {
      const matchingDocs = docsByBaseName.get(normalized) || [];

      console.log(`\nProcessing "${normalized}": ${matchingReports.length} reports, ${matchingDocs.length} documents`);

      // Case 1: No matching documents
      if (matchingDocs.length === 0) {
        for (const report of matchingReports) {
          result.unmatched.push({
            ...report,
            classification: report.classification,
          });
          
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: normalized,
            file_path: report.filePath,
            report_type: report.classification.type,
            similarity_percentage: report.classification.type === 'similarity' ? report.classification.percentage : null,
            ai_percentage: report.classification.type === 'ai' ? report.classification.percentage : null,
            uploaded_by: user.id,
          });
        }
        continue;
      }

      // Case 2: Multiple documents with same normalized filename
      if (matchingDocs.length > 1) {
        for (const doc of matchingDocs) {
          await supabase
            .from('documents')
            .update({
              needs_review: true,
              review_reason: `Multiple documents share the same normalized filename: ${normalized}`,
            })
            .eq('id', doc.id);

          result.needsReview.push({
            documentId: doc.id,
            reason: 'Multiple documents with same normalized filename',
          });
        }
        
        for (const report of matchingReports) {
          result.unmatched.push({
            ...report,
            classification: report.classification,
          });
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: normalized,
            file_path: report.filePath,
            report_type: report.classification.type,
            similarity_percentage: report.classification.type === 'similarity' ? report.classification.percentage : null,
            ai_percentage: report.classification.type === 'ai' ? report.classification.percentage : null,
            uploaded_by: user.id,
          });
        }
        continue;
      }

      // Case 3: Exactly one matching document
      const doc = matchingDocs[0];
      
      // Case 3a: More than 2 reports for one document
      if (matchingReports.length > 2) {
        await supabase
          .from('documents')
          .update({
            needs_review: true,
            review_reason: `More than 2 reports matched (${matchingReports.length} found)`,
          })
          .eq('id', doc.id);

        result.needsReview.push({
          documentId: doc.id,
          reason: `More than 2 reports found (${matchingReports.length})`,
        });
        
        for (const report of matchingReports) {
          result.unmatched.push({
            ...report,
            classification: report.classification,
          });
          await supabase.from('unmatched_reports').insert({
            file_name: report.fileName,
            normalized_filename: normalized,
            file_path: report.filePath,
            report_type: report.classification.type,
            similarity_percentage: report.classification.type === 'similarity' ? report.classification.percentage : null,
            ai_percentage: report.classification.type === 'ai' ? report.classification.percentage : null,
            uploaded_by: user.id,
          });
        }
        continue;
      }

      // Build update data based on classified reports
      const updateData: Record<string, unknown> = {};
      
      for (const report of matchingReports) {
        const classification = report.classification;
        
        if (classification.type === 'ai') {
          // Assign as AI report
          if (!doc.ai_report_path) {
            updateData.ai_report_path = report.filePath;
            if (classification.percentage !== null) {
              updateData.ai_percentage = classification.percentage;
            }
            
            result.mapped.push({
              documentId: doc.id,
              fileName: report.fileName,
              reportType: 'ai',
              percentage: classification.percentage,
              success: true,
            });
            result.stats.mappedCount++;
          } else {
            // AI slot already filled
            result.unmatched.push({
              ...report,
              classification,
            });
            await supabase.from('unmatched_reports').insert({
              file_name: report.fileName,
              normalized_filename: normalized,
              file_path: report.filePath,
              report_type: 'ai',
              ai_percentage: classification.percentage,
              uploaded_by: user.id,
            });
          }
        } else if (classification.type === 'similarity') {
          // Assign as Similarity report
          if (!doc.similarity_report_path) {
            updateData.similarity_report_path = report.filePath;
            if (classification.percentage !== null) {
              updateData.similarity_percentage = classification.percentage;
            }
            
            result.mapped.push({
              documentId: doc.id,
              fileName: report.fileName,
              reportType: 'similarity',
              percentage: classification.percentage,
              success: true,
            });
            result.stats.mappedCount++;
          } else {
            // Similarity slot already filled
            result.unmatched.push({
              ...report,
              classification,
            });
            await supabase.from('unmatched_reports').insert({
              file_name: report.fileName,
              normalized_filename: normalized,
              file_path: report.filePath,
              report_type: 'similarity',
              similarity_percentage: classification.percentage,
              uploaded_by: user.id,
            });
          }
        } else {
          // Unknown type - try to fit in available slot
          if (!doc.similarity_report_path && !updateData.similarity_report_path) {
            updateData.similarity_report_path = report.filePath;
            result.mapped.push({
              documentId: doc.id,
              fileName: report.fileName,
              reportType: 'similarity',
              percentage: null,
              success: true,
              message: 'Auto-assigned to similarity (unknown type)',
            });
            result.stats.mappedCount++;
          } else if (!doc.ai_report_path && !updateData.ai_report_path) {
            updateData.ai_report_path = report.filePath;
            result.mapped.push({
              documentId: doc.id,
              fileName: report.fileName,
              reportType: 'ai',
              percentage: null,
              success: true,
              message: 'Auto-assigned to AI (unknown type)',
            });
            result.stats.mappedCount++;
          } else {
            result.unmatched.push({
              ...report,
              classification,
            });
            await supabase.from('unmatched_reports').insert({
              file_name: report.fileName,
              normalized_filename: normalized,
              file_path: report.filePath,
              report_type: 'unknown',
              uploaded_by: user.id,
            });
          }
        }
      }

      // Check if document will be completed (both reports attached)
      const hasSimilarity = doc.similarity_report_path || updateData.similarity_report_path;
      const hasAI = doc.ai_report_path || updateData.ai_report_path;
      
      if (hasSimilarity && hasAI) {
        updateData.status = 'completed';
        updateData.completed_at = new Date().toISOString();
        result.completedDocuments.push(doc.id);
        result.stats.completedCount++;
        console.log(`Document ${doc.id} completed with both reports`);
      }

      // Apply updates
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('documents')
          .update(updateData)
          .eq('id', doc.id);

        if (updateError) {
          console.error(`Error updating document ${doc.id}:`, updateError);
        } else {
          console.log(`Updated document ${doc.id}:`, updateData);
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
        .select('id, file_name, user_id, similarity_percentage, ai_percentage')
        .eq('id', docId)
        .single();

      if (completedDoc?.user_id) {
        // Create user notification with percentages
        const simPercent = completedDoc.similarity_percentage;
        const aiPercent = completedDoc.ai_percentage;
        let message = `Your document "${completedDoc.file_name}" has been processed and is ready for download.`;
        if (simPercent !== null || aiPercent !== null) {
          const parts = [];
          if (simPercent !== null) parts.push(`Similarity: ${simPercent}%`);
          if (aiPercent !== null) parts.push(`AI: ${aiPercent}%`);
          message += ` Results: ${parts.join(', ')}.`;
        }
        
        await supabase.from('user_notifications').insert({
          user_id: completedDoc.user_id,
          title: 'Document Completed',
          message,
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
              userId: completedDoc.user_id,
              fileName: completedDoc.file_name,
              similarityPercentage: completedDoc.similarity_percentage,
              aiPercentage: completedDoc.ai_percentage,
            }),
          });
        } catch (emailError) {
          console.error('Failed to send completion email:', emailError);
        }
      }
    }

    console.log('\nBulk report processing complete:', result.stats);

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
