import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportInput {
  fileName: string;
  filePath: string;
  mappingKey: string;
}

interface MappingResult {
  reportFileName: string;
  documentFileName: string;
  documentId: string;
  mappingKey: string;
}

interface ProcessingResult {
  mapped: MappingResult[];
  unmapped: string[];
  stats: {
    totalReports: number;
    mapped: number;
    unmapped: number;
  };
}

// Extract mapping key: remove last 6-7 alphabet characters from filename (ignoring extension)
function extractMappingKey(filename: string): string {
  // Remove extension
  const baseName = filename.replace(/\.[^/.]+$/, '');
  
  // Find trailing alphabet characters
  const match = baseName.match(/([a-zA-Z]+)$/);
  if (!match) {
    // No trailing alphabets, return normalized base name
    return baseName.toLowerCase().trim().replace(/\s+/g, ' ');
  }
  
  const trailingAlphabets = match[1];
  
  // Remove 6-7 trailing alphabet characters
  let charsToRemove = 0;
  if (trailingAlphabets.length >= 7) {
    charsToRemove = 7;
  } else if (trailingAlphabets.length >= 6) {
    charsToRemove = 6;
  } else {
    // Less than 6 trailing alphabets, remove all of them
    charsToRemove = trailingAlphabets.length;
  }
  
  const key = baseName.slice(0, baseName.length - charsToRemove);
  
  // Normalize: lowercase, trim, normalize spaces
  return key.toLowerCase().trim().replace(/\s+/g, ' ');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || !['admin', 'staff'].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { reports } = await req.json() as { reports: ReportInput[] };
    
    if (!reports || !Array.isArray(reports) || reports.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No reports provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${reports.length} reports for auto-mapping`);

    // Fetch all pending/in_progress documents
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, normalized_filename, status')
      .in('status', ['pending', 'in_progress'])
      .is('similarity_report_path', null);

    if (docError) {
      console.error('Error fetching documents:', docError);
      throw docError;
    }

    console.log(`Found ${documents?.length || 0} documents to match against`);

    // Build document lookup map by mapping key
    const documentsByKey: Map<string, typeof documents[0]> = new Map();
    for (const doc of documents || []) {
      const key = extractMappingKey(doc.file_name);
      documentsByKey.set(key, doc);
      console.log(`Document "${doc.file_name}" -> key: "${key}"`);
    }

    const result: ProcessingResult = {
      mapped: [],
      unmapped: [],
      stats: {
        totalReports: reports.length,
        mapped: 0,
        unmapped: 0
      }
    };

    // Process each report
    for (const report of reports) {
      const reportKey = report.mappingKey;
      console.log(`Report "${report.fileName}" has key: "${reportKey}"`);
      
      const matchedDoc = documentsByKey.get(reportKey);
      
      if (matchedDoc) {
        // Update document with similarity report and set status to completed
        const { error: updateError } = await supabase
          .from('documents')
          .update({
            similarity_report_path: report.filePath,
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', matchedDoc.id);

        if (updateError) {
          console.error(`Error updating document ${matchedDoc.id}:`, updateError);
          result.unmapped.push(report.fileName);
          result.stats.unmapped++;
          continue;
        }

        // Create notification for user
        const { data: docData } = await supabase
          .from('documents')
          .select('user_id, file_name')
          .eq('id', matchedDoc.id)
          .single();

        if (docData?.user_id) {
          await supabase.from('notifications').insert({
            title: 'Document Completed',
            message: `Your document "${docData.file_name}" has been processed and is ready for download.`,
            category: 'document',
            target_audience: 'customer',
            created_by: user.id
          });

          // Send push notification
          try {
            await supabase.functions.invoke('send-push-notification', {
              body: {
                userId: docData.user_id,
                title: 'Document Completed',
                body: `Your document "${docData.file_name}" is ready!`,
                eventType: 'document_completed'
              }
            });
          } catch (pushError) {
            console.error('Push notification error:', pushError);
          }

          // Send completion email
          try {
            await supabase.functions.invoke('send-completion-email', {
              body: {
                documentId: matchedDoc.id,
                userId: docData.user_id
              }
            });
          } catch (emailError) {
            console.error('Email notification error:', emailError);
          }
        }

        result.mapped.push({
          reportFileName: report.fileName,
          documentFileName: matchedDoc.file_name,
          documentId: matchedDoc.id,
          mappingKey: reportKey
        });
        result.stats.mapped++;

        // Remove from map to prevent duplicate matching
        documentsByKey.delete(reportKey);
        
        console.log(`✓ Mapped "${report.fileName}" to "${matchedDoc.file_name}"`);
      } else {
        result.unmapped.push(report.fileName);
        result.stats.unmapped++;
        console.log(`✗ No match found for "${report.fileName}"`);
      }
    }

    console.log(`Processing complete: ${result.stats.mapped} mapped, ${result.stats.unmapped} unmapped`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in similarity-auto-map:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
