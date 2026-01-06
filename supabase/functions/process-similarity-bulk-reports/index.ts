import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportResult {
  fileName: string;
  status: 'mapped' | 'unmatched' | 'error';
  documentId?: string;
  percentage?: number;
  error?: string;
}

// Normalize filename for matching
function normalizeFilename(filename: string): string {
  let result = filename.toLowerCase();
  // Remove extension
  result = result.replace(/\.[^.]+$/, '');
  // Remove trailing (1), (2), etc.
  result = result.replace(/\s*\(\d+\)\s*$/, '');
  // Remove extra spaces and trim
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

// Extract percentage from text
function extractSimilarityPercentage(text: string): number | null {
  // Pattern: "XX% overall similarity" or "XX % overall similarity"
  const patterns = [
    /(\d+(?:\.\d+)?)\s*%\s*overall\s*similarity/i,
    /overall\s*similarity[:\s]*(\d+(?:\.\d+)?)\s*%/i,
    /similarity[:\s]*(\d+(?:\.\d+)?)\s*%/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseFloat(match[1]);
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user and check role
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is admin or staff
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || !['admin', 'staff'].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ error: 'No files provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: ReportResult[] = [];
    let mappedCount = 0;
    let unmatchedCount = 0;
    let completedCount = 0;

    // Fetch all queued/processing items from similarity_queue for matching
    const { data: queueItems } = await supabase
      .from('similarity_queue')
      .select('id, original_filename, normalized_filename, report_path, queue_status')
      .in('queue_status', ['queued', 'processing']);

    interface QueueRecord {
      id: string;
      original_filename: string;
      normalized_filename: string;
      report_path: string | null;
      queue_status: string;
    }

    const queueMap = new Map<string, QueueRecord>();
    if (queueItems) {
      for (const item of queueItems as QueueRecord[]) {
        const normalizedKey = item.normalized_filename || normalizeFilename(item.original_filename);
        queueMap.set(normalizedKey, item);
      }
    }

    for (const file of files) {
      try {
        // Only process PDF files
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          results.push({
            fileName: file.name,
            status: 'error',
            error: 'Not a PDF file',
          });
          continue;
        }

        const normalizedKey = normalizeFilename(file.name);
        const matchedItem = queueMap.get(normalizedKey);

        // Read file for percentage extraction
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Try to extract text from PDF for percentage
        let percentage: number | null = null;
        try {
          // Import pdfjs-serverless dynamically
          const pdfjsModule = await import("https://esm.sh/pdfjs-serverless@0.4.1");
          const pdfjsLib = await pdfjsModule.resolvePDFJS();
          const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;
          
          // Read ONLY page 2
          if (pdf.numPages >= 2) {
            const page = await pdf.getPage(2);
            const textContent = await page.getTextContent();
            const text = textContent.items
              .filter((item: any) => 'str' in item)
              .map((item: any) => item.str)
              .join(' ');
            
            percentage = extractSimilarityPercentage(text);
            console.log(`Extracted percentage from ${file.name}: ${percentage}`);
          }
        } catch (pdfError) {
          console.error(`PDF parsing error for ${file.name}:`, pdfError);
          // Continue without percentage extraction
        }

        if (matchedItem) {
          // Upload report to storage
          const reportPath = `similarity-queue/${matchedItem.id}/report_${Date.now()}_${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('reports')
            .upload(reportPath, uint8Array, {
              contentType: 'application/pdf',
            });

          if (uploadError) {
            console.error(`Upload error for ${file.name}:`, uploadError);
            results.push({
              fileName: file.name,
              status: 'error',
              error: uploadError.message,
            });
            continue;
          }

          // Update similarity_queue item with report
          const updateData: Record<string, any> = {
            report_path: reportPath,
            queue_status: 'completed',
            processed_at: new Date().toISOString(),
          };

          if (percentage !== null) {
            updateData.similarity_percentage = percentage;
          }

          const { error: updateError } = await supabase
            .from('similarity_queue')
            .update(updateData)
            .eq('id', matchedItem.id);

          if (updateError) {
            console.error(`Update error for ${file.name}:`, updateError);
            results.push({
              fileName: file.name,
              status: 'error',
              error: updateError.message,
            });
            continue;
          }

          results.push({
            fileName: file.name,
            status: 'mapped',
            documentId: matchedItem.id,
            percentage: percentage ?? undefined,
          });
          mappedCount++;
          completedCount++;

          // Remove from map to prevent duplicate matches
          queueMap.delete(normalizedKey);
        } else {
          // No match found - store as unmatched
          const unmatchedPath = `unmatched/${Date.now()}_${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('reports')
            .upload(unmatchedPath, uint8Array, {
              contentType: 'application/pdf',
            });

          if (uploadError) {
            console.error(`Unmatched upload error for ${file.name}:`, uploadError);
            results.push({
              fileName: file.name,
              status: 'error',
              error: uploadError.message,
            });
            continue;
          }

          // Insert into unmatched_reports
          await supabase.from('unmatched_reports').insert({
            file_name: file.name,
            normalized_filename: normalizedKey,
            file_path: unmatchedPath,
            report_type: 'similarity',
            similarity_percentage: percentage,
            uploaded_by: user.id,
          });

          results.push({
            fileName: file.name,
            status: 'unmatched',
            percentage: percentage ?? undefined,
          });
          unmatchedCount++;
        }
      } catch (fileError) {
        console.error(`Error processing ${file.name}:`, fileError);
        results.push({
          fileName: file.name,
          status: 'error',
          error: fileError instanceof Error ? fileError.message : 'Unknown error',
        });
      }
    }

    console.log(`Processed ${files.length} files: ${mappedCount} mapped, ${unmatchedCount} unmatched, ${completedCount} completed`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        summary: {
          total: files.length,
          mapped: mappedCount,
          unmatched: unmatchedCount,
          completed: completedCount,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
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
