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

    // Get the global processing timeout setting (fallback)
    const { data: settingData, error: settingError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'processing_timeout_minutes')
      .maybeSingle();

    if (settingError) {
      console.error('Error fetching timeout setting:', settingError);
      throw settingError;
    }

    const globalTimeoutMinutes = settingData ? parseInt(settingData.value) : 30;
    console.log(`Global timeout: ${globalTimeoutMinutes} minutes`);

    // Find all in-progress documents with their assigned staff
    const { data: inProgressDocuments, error: fetchError } = await supabase
      .from('documents')
      .select('id, file_name, assigned_staff_id, assigned_at')
      .eq('status', 'in_progress')
      .not('assigned_at', 'is', null);

    if (fetchError) {
      console.error('Error fetching in-progress documents:', fetchError);
      throw fetchError;
    }

    if (!inProgressDocuments || inProgressDocuments.length === 0) {
      console.log('No in-progress documents found');
      return new Response(
        JSON.stringify({ message: 'No in-progress documents found', released: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${inProgressDocuments.length} in-progress documents to check`);

    // Get unique staff IDs
    const staffIds = [...new Set(inProgressDocuments.map(d => d.assigned_staff_id).filter(Boolean))];
    
    // Fetch individual staff settings
    let staffSettingsMap: Record<string, number> = {};
    if (staffIds.length > 0) {
      const { data: staffSettings } = await supabase
        .from('staff_settings')
        .select('user_id, time_limit_minutes')
        .in('user_id', staffIds);
      
      if (staffSettings) {
        staffSettingsMap = Object.fromEntries(
          staffSettings.map(s => [s.user_id, s.time_limit_minutes])
        );
      }
      console.log(`Found settings for ${Object.keys(staffSettingsMap).length} staff members`);
    }

    // Check each document against its staff's personal timeout
    const now = Date.now();
    const overdueDocuments = inProgressDocuments.filter(doc => {
      const staffTimeout = staffSettingsMap[doc.assigned_staff_id] ?? globalTimeoutMinutes;
      const cutoffTime = now - staffTimeout * 60 * 1000;
      const assignedTime = new Date(doc.assigned_at).getTime();
      const isOverdue = assignedTime < cutoffTime;
      
      if (isOverdue) {
        console.log(`Document ${doc.file_name} is overdue (staff timeout: ${staffTimeout}min)`);
      }
      
      return isOverdue;
    });

    if (overdueDocuments.length === 0) {
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
      const staffTimeout = staffSettingsMap[doc.assigned_staff_id] ?? globalTimeoutMinutes;
      console.log(`Released document: ${doc.file_name} (ID: ${doc.id}) - was assigned to staff ${doc.assigned_staff_id} (timeout: ${staffTimeout}min)`);
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