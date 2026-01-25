import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-extension-token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface ExtensionRequest {
  action: string;
  documentId?: string;
  status?: string;
  automationStatus?: string;
  similarityPercentage?: number;
  aiPercentage?: number;
  similarityReportPath?: string;
  aiReportPath?: string;
  errorMessage?: string;
  fileData?: string;
  fileName?: string;
  bucketName?: string;
  filePath?: string;
  browserInfo?: string;
  logAction?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Create admin client for database operations
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Get extension token from header
    const extensionToken = req.headers.get('x-extension-token');
    
    if (!extensionToken) {
      return new Response(
        JSON.stringify({ error: 'Missing extension token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('extension_tokens')
      .select('*')
      .eq('token', extensionToken)
      .eq('is_active', true)
      .single();

    if (tokenError || !tokenData) {
      console.error('Token validation failed:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Invalid or inactive token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Token has expired' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update last used timestamp
    await supabaseAdmin
      .from('extension_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', tokenData.id);

    // Parse request body
    const body: ExtensionRequest = await req.json();
    const { action } = body;

    console.log(`Extension API called: action=${action}, tokenId=${tokenData.id}`);

    // Log the action
    const logAction = async (status: string, errorMessage?: string, metadata?: Record<string, unknown>) => {
      await supabaseAdmin.from('extension_logs').insert({
        token_id: tokenData.id,
        document_id: body.documentId || null,
        action,
        status,
        error_message: errorMessage || null,
        metadata: metadata || null,
      });
    };

    // Handle different actions
    switch (action) {
      case 'heartbeat': {
        // Update heartbeat timestamp
        await supabaseAdmin
          .from('extension_tokens')
          .update({ 
            last_heartbeat_at: new Date().toISOString(),
            browser_info: body.browserInfo || null
          })
          .eq('id', tokenData.id);

        await logAction('success');
        return new Response(
          JSON.stringify({ success: true, message: 'Heartbeat received' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_pending_documents': {
        // Fetch pending documents that haven't been automated yet
        const { data: documents, error } = await supabaseAdmin
          .from('documents')
          .select('id, file_name, file_path, scan_type, user_id, uploaded_at, automation_status, automation_attempt_count')
          .eq('status', 'pending')
          .or('automation_status.is.null,automation_status.eq.failed')
          .order('uploaded_at', { ascending: true })
          .limit(10);

        if (error) {
          console.error('Error fetching documents:', error);
          await logAction('error', error.message);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch documents' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await logAction('success', undefined, { documentCount: documents?.length || 0 });
        return new Response(
          JSON.stringify({ documents: documents || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_signed_url': {
        const { bucketName, filePath } = body;
        
        if (!bucketName || !filePath) {
          console.error('get_signed_url: Missing params', { bucketName, filePath });
          return new Response(
            JSON.stringify({ error: 'Missing bucketName or filePath', details: { bucketName, filePath } }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Creating signed URL for:', { bucketName, filePath });

        // First check if the file exists
        const { data: fileList, error: listError } = await supabaseAdmin.storage
          .from(bucketName)
          .list(filePath.split('/').slice(0, -1).join('/') || '', {
            search: filePath.split('/').pop()
          });

        if (listError) {
          console.error('Error listing files:', listError, { bucketName, filePath });
        } else {
          console.log('File list result:', fileList);
        }

        const { data, error } = await supabaseAdmin.storage
          .from(bucketName)
          .createSignedUrl(filePath, 3600); // 1 hour expiry

        if (error) {
          console.error('Error creating signed URL:', error, { bucketName, filePath });
          await logAction('error', `${error.message} - bucket: ${bucketName}, path: ${filePath}`, { bucketName, filePath });
          return new Response(
            JSON.stringify({ error: 'Failed to create signed URL', details: error.message, bucketName, filePath }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await logAction('success', undefined, { bucketName, filePath });
        return new Response(
          JSON.stringify({ signedUrl: data.signedUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_document_status': {
        const { documentId, status, automationStatus, errorMessage } = body;
        
        if (!documentId) {
          return new Response(
            JSON.stringify({ error: 'Missing documentId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (status) updateData.status = status;
        if (automationStatus) updateData.automation_status = automationStatus;
        if (errorMessage) updateData.automation_error = errorMessage;
        if (automationStatus === 'processing') {
          updateData.automation_started_at = new Date().toISOString();
        }

        const { error } = await supabaseAdmin
          .from('documents')
          .update(updateData)
          .eq('id', documentId);

        if (error) {
          console.error('Error updating document:', error);
          await logAction('error', error.message, { documentId, updateData });
          return new Response(
            JSON.stringify({ error: 'Failed to update document' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await logAction('success', undefined, { documentId, updateData });
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'increment_attempt_count': {
        const { documentId } = body;
        
        if (!documentId) {
          return new Response(
            JSON.stringify({ error: 'Missing documentId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get current count
        const { data: doc } = await supabaseAdmin
          .from('documents')
          .select('automation_attempt_count')
          .eq('id', documentId)
          .single();

        const currentCount = doc?.automation_attempt_count || 0;

        const { error } = await supabaseAdmin
          .from('documents')
          .update({ 
            automation_attempt_count: currentCount + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', documentId);

        if (error) {
          console.error('Error incrementing attempt count:', error);
          await logAction('error', error.message, { documentId });
          return new Response(
            JSON.stringify({ error: 'Failed to increment attempt count' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await logAction('success', undefined, { documentId, newCount: currentCount + 1 });
        return new Response(
          JSON.stringify({ success: true, newCount: currentCount + 1 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'upload_report': {
        const { fileData, fileName, bucketName, filePath } = body;
        
        if (!fileData || !fileName || !bucketName || !filePath) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields for upload' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Decode base64 file data
        const binaryData = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));

        const { error } = await supabaseAdmin.storage
          .from(bucketName)
          .upload(filePath, binaryData, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (error) {
          console.error('Error uploading report:', error);
          await logAction('error', error.message, { bucketName, filePath });
          return new Response(
            JSON.stringify({ error: 'Failed to upload report' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await logAction('success', undefined, { bucketName, filePath });
        return new Response(
          JSON.stringify({ success: true, path: filePath }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'complete_document': {
        const { documentId, similarityPercentage, aiPercentage, similarityReportPath, aiReportPath } = body;
        
        if (!documentId) {
          return new Response(
            JSON.stringify({ error: 'Missing documentId' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: Record<string, unknown> = {
          status: 'completed',
          automation_status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        if (similarityPercentage !== undefined) updateData.similarity_percentage = similarityPercentage;
        if (aiPercentage !== undefined) updateData.ai_percentage = aiPercentage;
        if (similarityReportPath) updateData.similarity_report_path = similarityReportPath;
        if (aiReportPath) updateData.ai_report_path = aiReportPath;

        const { error } = await supabaseAdmin
          .from('documents')
          .update(updateData)
          .eq('id', documentId);

        if (error) {
          console.error('Error completing document:', error);
          await logAction('error', error.message, { documentId, updateData });
          return new Response(
            JSON.stringify({ error: 'Failed to complete document' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await logAction('success', undefined, { documentId, ...updateData });
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'log_automation': {
        const { documentId, logAction: actionType, message, metadata } = body;
        
        await supabaseAdmin.from('automation_logs').insert({
          document_id: documentId || null,
          action: actionType || 'unknown',
          message: message || null,
          metadata: metadata || null,
          status: 'success',
        });

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        await logAction('error', `Unknown action: ${action}`);
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Extension API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
