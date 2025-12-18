import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting auto-release documents check...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the processing timeout setting
    const { data: settingData, error: settingError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'processing_timeout_minutes')
      .maybeSingle();

    if (settingError) {
      console.error('Error fetching timeout setting:', settingError);
      throw settingError;
    }

    const timeoutMinutes = settingData ? parseInt(settingData.value) : 30;
    console.log(`Using timeout of ${timeoutMinutes} minutes`);

    // Calculate the cutoff time
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000).toISOString();
    console.log(`Looking for documents assigned before: ${cutoffTime}`);

    // Find overdue documents (in_progress and assigned_at older than timeout)
    const { data: overdueDocuments, error: fetchError } = await supabase
      .from('documents')
      .select('id, file_name, assigned_staff_id, assigned_at')
      .eq('status', 'in_progress')
      .not('assigned_at', 'is', null)
      .lt('assigned_at', cutoffTime);

    if (fetchError) {
      console.error('Error fetching overdue documents:', fetchError);
      throw fetchError;
    }

    if (!overdueDocuments || overdueDocuments.length === 0) {
      console.log('No overdue documents found');
      return new Response(
        JSON.stringify({ message: 'No overdue documents found', released: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${overdueDocuments.length} overdue documents to release`);

    // Release each overdue document
    const documentIds = overdueDocuments.map(doc => doc.id);
    
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        status: 'pending',
        assigned_staff_id: null,
        assigned_at: null,
        updated_at: new Date().toISOString()
      })
      .in('id', documentIds);

    if (updateError) {
      console.error('Error releasing documents:', updateError);
      throw updateError;
    }

    // Log the releases
    for (const doc of overdueDocuments) {
      console.log(`Released document: ${doc.file_name} (ID: ${doc.id}) - was assigned to staff ${doc.assigned_staff_id}`);
    }

    console.log(`Successfully released ${overdueDocuments.length} overdue documents`);

    return new Response(
      JSON.stringify({ 
        message: `Released ${overdueDocuments.length} overdue documents`,
        released: overdueDocuments.length,
        documents: overdueDocuments.map(d => ({ id: d.id, file_name: d.file_name }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error in auto-release-documents:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
