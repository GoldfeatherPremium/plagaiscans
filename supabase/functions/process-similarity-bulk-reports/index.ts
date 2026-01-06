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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting process-similarity-bulk-reports...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('No auth header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user and check role
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.log('Auth error:', authError);
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
      console.log('Forbidden - role:', roleData?.role);
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User authenticated:', user.id, 'Role:', roleData.role);

    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      console.log('No files provided');
      return new Response(JSON.stringify({ error: 'No files provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${files.length} files`);

    const results: ReportResult[] = [];
    let mappedCount = 0;
    let unmatchedCount = 0;
    let completedCount = 0;

    // Fetch all similarity_only pending/in_progress documents for matching
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, normalized_filename, similarity_report_path, status')
      .eq('scan_type', 'similarity_only')
      .in('status', ['pending', 'in_progress']);

    if (docError) {
      console.error('Error fetching documents:', docError);
      throw new Error('Failed to fetch documents');
    }

    console.log(`Found ${documents?.length || 0} similarity_only documents to match against`);

    interface DocRecord {
      id: string;
      file_name: string;
      normalized_filename: string | null;
      similarity_report_path: string | null;
      status: string;
    }

    const docMap = new Map<string, DocRecord>();
    if (documents) {
      for (const doc of documents as DocRecord[]) {
        const normalizedKey = doc.normalized_filename || normalizeFilename(doc.file_name);
        docMap.set(normalizedKey, doc);
        console.log(`Document key: "${normalizedKey}" -> ${doc.id}`);
      }
    }

    for (const file of files) {
      try {
        console.log(`Processing file: ${file.name}`);
        
        // Only process PDF files
        if (!file.name.toLowerCase().endsWith('.pdf')) {
          console.log(`Skipping non-PDF file: ${file.name}`);
          results.push({
            fileName: file.name,
            status: 'error',
            error: 'Not a PDF file',
          });
          continue;
        }

        const normalizedKey = normalizeFilename(file.name);
        console.log(`Normalized key for ${file.name}: "${normalizedKey}"`);
        
        const matchedDoc = docMap.get(normalizedKey);

        // Read file as bytes
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        if (matchedDoc) {
          console.log(`Match found for ${file.name} -> Document ${matchedDoc.id}`);
          
          // Upload report to storage
          const reportPath = `${matchedDoc.id}/similarity_${Date.now()}_${file.name}`;
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

          console.log(`Uploaded report to: ${reportPath}`);

          // Update document with report
          const updateData: Record<string, any> = {
            similarity_report_path: reportPath,
            status: 'completed',
            completed_at: new Date().toISOString(),
            assigned_staff_id: user.id,
            assigned_at: new Date().toISOString(),
          };

          const { error: updateError } = await supabase
            .from('documents')
            .update(updateData)
            .eq('id', matchedDoc.id);

          if (updateError) {
            console.error(`Update error for ${file.name}:`, updateError);
            results.push({
              fileName: file.name,
              status: 'error',
              error: updateError.message,
            });
            continue;
          }

          console.log(`Updated document ${matchedDoc.id} to completed`);

          // Log activity
          await supabase.from('activity_logs').insert({
            staff_id: user.id,
            document_id: matchedDoc.id,
            action: 'bulk_completed_similarity',
          });

          results.push({
            fileName: file.name,
            status: 'mapped',
            documentId: matchedDoc.id,
          });
          mappedCount++;
          completedCount++;

          // Remove from map to prevent duplicate matches
          docMap.delete(normalizedKey);
        } else {
          console.log(`No match found for ${file.name} with key "${normalizedKey}"`);
          
          // No match found - store as unmatched
          const unmatchedPath = `unmatched/similarity_${Date.now()}_${file.name}`;
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
          const { error: insertError } = await supabase.from('unmatched_reports').insert({
            file_name: file.name,
            normalized_filename: normalizedKey,
            file_path: unmatchedPath,
            report_type: 'similarity',
            uploaded_by: user.id,
          });

          if (insertError) {
            console.error(`Insert unmatched error for ${file.name}:`, insertError);
          }

          results.push({
            fileName: file.name,
            status: 'unmatched',
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

    console.log(`Completed: ${mappedCount} mapped, ${unmatchedCount} unmatched, ${completedCount} completed`);

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
