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
  reportType: 'similarity' | 'ai' | 'unknown';
  percentage: number | null;
  classificationSource: 'text' | 'ocr' | 'failed';
}

interface MappingResult {
  documentId: string;
  fileName: string;
  reportType: 'similarity' | 'ai' | 'unknown';
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
  // This handles cases like "file (1) (2)" → "file"
  while (/\s*\(\d+\)\s*$/.test(result)) {
    result = result.replace(/\s*\(\d+\)\s*$/, '');
  }
  
  // Step 3: Remove leading/trailing brackets [] or ()
  result = result.replace(/^\[([^\]]*)\]$/, '$1');
  result = result.replace(/^\(([^)]*)\)$/, '$1');
  
  // Also handle mixed bracket patterns at start
  result = result.replace(/^\[Guest\]\s*/i, '');
  
  // Step 4: Normalize - lowercase and collapse multiple spaces
  result = result.toLowerCase();
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

/**
 * STAGE 2: Classify report type by analyzing PDF content
 * Uses Gemini Vision API to analyze page 2 of the PDF
 */
async function classifyReportWithAI(
  supabase: any,
  filePath: string,
  lovableApiKey: string
): Promise<{ reportType: 'similarity' | 'ai' | 'unknown'; percentage: number | null; source: 'text' | 'ocr' | 'failed' }> {
  try {
    // Download the PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('reports')
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('Failed to download PDF:', downloadError);
      return { reportType: 'unknown', percentage: null, source: 'failed' };
    }

    // Convert PDF to base64
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Use Gemini Vision API to analyze the PDF
    const response = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze page 2 of this PDF report and determine if it's a Similarity Report or an AI Detection Report.

CLASSIFICATION RULES:

SIMILARITY REPORT - If page 2 contains ANY of these phrases:
- "overall similarity"
- "match groups"  
- "integrity overview"

AI REPORT - If page 2 contains ANY of these phrases:
- "detected as ai"
- "ai writing overview"
- "detection groups"

PERCENTAGE EXTRACTION:
- For Similarity Reports: Find the pattern "X% overall similarity" and extract X
- For AI Reports: Find the pattern "X% detected as ai" and extract X
- If AI report shows "*% detected as AI" (asterisk), return null for percentage

Respond with ONLY a JSON object in this exact format:
{
  "reportType": "similarity" | "ai" | "unknown",
  "percentage": number | null,
  "confidence": "high" | "medium" | "low",
  "matchedPhrase": "the phrase that matched"
}

Do not include any other text, just the JSON.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64Pdf}`
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return { reportType: 'unknown', percentage: null, source: 'failed' };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    console.log('Gemini classification response:', content);

    // Parse the JSON response
    try {
      // Extract JSON from response (handle potential markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const reportType = parsed.reportType === 'similarity' ? 'similarity' : 
                          parsed.reportType === 'ai' ? 'ai' : 'unknown';
        const percentage = typeof parsed.percentage === 'number' ? parsed.percentage : null;
        
        return { reportType, percentage, source: 'ocr' };
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
    }

    return { reportType: 'unknown', percentage: null, source: 'failed' };

  } catch (error) {
    console.error('Error in AI classification:', error);
    return { reportType: 'unknown', percentage: null, source: 'failed' };
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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
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

    console.log(`Processing ${reports.length} reports with new two-stage algorithm`);

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
      },
    };

    // ============= STAGE 2: REPORT CLASSIFICATION =============
    // Process each group of reports
    for (const [docKey, matchingReports] of reportsByKey) {
      const matchingDocs = docsByKey.get(docKey) || [];

      console.log(`Processing document_key "${docKey}": ${matchingReports.length} reports, ${matchingDocs.length} matching documents`);

      // Case 1: No matching documents - unmatched reports
      if (matchingDocs.length === 0) {
        for (const report of matchingReports) {
          // Still classify the report for logging
          const classification = await classifyReportWithAI(supabase, report.filePath, lovableApiKey);
          
          result.unmatched.push({
            fileName: report.fileName,
            documentKey: docKey,
            filePath: report.filePath,
            reportType: classification.reportType,
          });
          
          // Update stats
          if (classification.reportType === 'similarity') result.stats.classifiedAsSimilarity++;
          else if (classification.reportType === 'ai') result.stats.classifiedAsAI++;
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
            uploaded_by: user.id,
          });
        }
        continue;
      }

      // Case 3: Exactly one matching document - classify and attach reports
      const doc = matchingDocs[0];
      
      // Classify each report using AI/OCR
      const classifiedReports: ClassifiedReport[] = [];
      
      for (const report of matchingReports) {
        console.log(`Classifying report: ${report.fileName}`);
        const classification = await classifyReportWithAI(supabase, report.filePath, lovableApiKey);
        
        classifiedReports.push({
          ...report,
          documentKey: docKey,
          reportType: classification.reportType,
          percentage: classification.percentage,
          classificationSource: classification.source,
        });

        console.log(`Report "${report.fileName}" classified as: ${classification.reportType} (${classification.percentage}%)`);

        // Update stats
        if (classification.reportType === 'similarity') result.stats.classifiedAsSimilarity++;
        else if (classification.reportType === 'ai') result.stats.classifiedAsAI++;
        else result.stats.classifiedAsUnknown++;
      }

      // Separate reports by type
      const similarityReports = classifiedReports.filter(r => r.reportType === 'similarity');
      const aiReports = classifiedReports.filter(r => r.reportType === 'ai');
      const unknownReports = classifiedReports.filter(r => r.reportType === 'unknown');

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

      // Handle unknown reports
      for (const unknownReport of unknownReports) {
        result.unmatched.push({
          fileName: unknownReport.fileName,
          documentKey: docKey,
          filePath: unknownReport.filePath,
          reportType: 'unknown',
        });
        await supabase.from('unmatched_reports').insert({
          file_name: unknownReport.fileName,
          normalized_filename: docKey,
          file_path: unknownReport.filePath,
          report_type: 'unknown',
          similarity_percentage: null,
          ai_percentage: null,
          uploaded_by: user.id,
        });
      }

      // Check if both reports are now attached - mark as completed
      const willHaveSimilarity = updateData.similarity_report_path || doc.similarity_report_path;
      const willHaveAI = updateData.ai_report_path || doc.ai_report_path;
      
      if (willHaveSimilarity && willHaveAI) {
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
        // Create user notification
        await supabase.from('user_notifications').insert({
          user_id: completedDoc.user_id,
          title: 'Document Completed',
          message: `Your document "${completedDoc.file_name}" has been processed and is ready for download.`,
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
