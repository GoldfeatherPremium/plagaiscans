import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check global push notifications toggle
    const { data: globalSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'push_notifications_enabled')
      .maybeSingle();

    if (globalSetting?.value === 'false') {
      console.log('Push notifications are globally disabled');
      return new Response(
        JSON.stringify({ message: 'Push notifications are globally disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check document upload notifications toggle
    const { data: docUploadSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'push_document_upload_notifications_enabled')
      .maybeSingle();

    if (docUploadSetting?.value === 'false') {
      console.log('Document upload notifications are disabled');
      return new Response(
        JSON.stringify({ message: 'Document upload notifications are disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unprocessed document upload notifications
    const { data: notifications, error: notifError } = await supabase
      .from('document_upload_notifications')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(10);

    if (notifError) {
      console.error('Error fetching notifications:', notifError);
      throw notifError;
    }

    if (!notifications || notifications.length === 0) {
      console.log('No pending notifications');
      return new Response(
        JSON.stringify({ message: 'No pending notifications' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${notifications.length} notifications`);

    let sentCount = 0;
    let failedCount = 0;

    // Process each notification by calling send-push-notification function
    for (const notification of notifications) {
      try {
        console.log(`Sending notification for document: ${notification.file_name}, scan_type: ${notification.scan_type}`);
        
        // Determine correct queue URL and title based on scan type
        const isSimilarityOnly = notification.scan_type === 'similarity_only';
        const queueUrl = isSimilarityOnly 
          ? '/dashboard/queue-similarity' 
          : '/dashboard/queue';
        
        const notificationTitle = isSimilarityOnly 
          ? '📊 New Doc in Similarity Queue' 
          : '📄 New Doc in AI Scan Queue';
        
        const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            title: notificationTitle,
            body: `${notification.customer_name} uploaded "${notification.file_name}"`,
            icon: '/pwa-icon-192.png',
            badge: '/pwa-icon-192.png',
            url: queueUrl,
            data: { documentId: notification.document_id, scanType: notification.scan_type },
            targetAudience: 'staff_and_admins',
            eventType: 'document_upload',
          }),
        });

        const result = await response.json();
        console.log(`Notification result for ${notification.id}:`, result);
        
        if (result.success || result.sent > 0) {
          sentCount += result.sent || 1;
        } else {
          failedCount++;
        }
      } catch (error) {
        console.error(`Error sending notification for ${notification.id}:`, error);
        failedCount++;
      }

      // Mark notification as processed
      await supabase
        .from('document_upload_notifications')
        .update({ processed: true })
        .eq('id', notification.id);
    }

    console.log(`Completed: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        notificationsProcessed: notifications.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in notify-document-upload:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});