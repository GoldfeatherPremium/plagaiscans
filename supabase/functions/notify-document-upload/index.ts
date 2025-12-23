import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

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
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys not configured');
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Get all staff and admin users
    const { data: staffAdminRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['admin', 'staff']);

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
      throw rolesError;
    }

    const staffAdminUserIds = staffAdminRoles?.map(r => r.user_id) || [];
    console.log(`Found ${staffAdminUserIds.length} staff/admin users`);

    if (staffAdminUserIds.length === 0) {
      // Mark as processed anyway
      await supabase
        .from('document_upload_notifications')
        .update({ processed: true })
        .in('id', notifications.map(n => n.id));

      return new Response(
        JSON.stringify({ message: 'No staff/admin users to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get notification preferences for staff/admin
    const { data: preferences, error: prefError } = await supabase
      .from('user_notification_preferences')
      .select('user_id, document_upload_enabled')
      .in('user_id', staffAdminUserIds);

    if (prefError) {
      console.error('Error fetching preferences:', prefError);
    }

    // Create a map of user preferences (default to true if no preference set)
    const prefMap = new Map<string, boolean>();
    for (const userId of staffAdminUserIds) {
      prefMap.set(userId, true); // Default enabled
    }
    for (const pref of preferences || []) {
      prefMap.set(pref.user_id, pref.document_upload_enabled);
    }

    // Filter to only users who have notifications enabled
    const enabledUserIds = staffAdminUserIds.filter(id => prefMap.get(id) === true);
    console.log(`${enabledUserIds.length} users have document upload notifications enabled`);

    if (enabledUserIds.length === 0) {
      // Mark as processed
      await supabase
        .from('document_upload_notifications')
        .update({ processed: true })
        .in('id', notifications.map(n => n.id));

      return new Response(
        JSON.stringify({ message: 'No users with notifications enabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get push subscriptions for enabled users
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', enabledUserIds);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found');
      // Mark as processed
      await supabase
        .from('document_upload_notifications')
        .update({ processed: true })
        .in('id', notifications.map(n => n.id));

      return new Response(
        JSON.stringify({ message: 'No push subscriptions found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${subscriptions.length} push subscriptions`);

    // Configure web-push
    webpush.setVapidDetails(
      'mailto:support@plagaiscans.com',
      vapidPublicKey,
      vapidPrivateKey
    );

    let sentCount = 0;
    let failedCount = 0;
    const invalidSubscriptions: string[] = [];

    // Process each notification
    for (const notification of notifications) {
      // Create log entry for this notification
      await supabase.from('push_notification_logs').insert({
        event_type: 'document_upload',
        title: 'New Document Uploaded',
        body: `${notification.customer_name} uploaded "${notification.file_name}"`,
        target_audience: 'staff',
        recipient_count: subscriptions.length,
        status: 'sending',
      });

      const payload = JSON.stringify({
        title: '📄 New Document Uploaded',
        body: `${notification.customer_name} uploaded "${notification.file_name}"`,
        icon: '/pwa-icon-192.png',
        badge: '/pwa-icon-192.png',
        data: {
          url: '/document-queue',
          documentId: notification.document_id,
        },
      });

      // Send to all subscriptions with retry
      for (const sub of subscriptions) {
        let retryCount = 0;
        const maxRetries = 1;
        let success = false;

        while (retryCount <= maxRetries && !success) {
          try {
            const pushSubscription = {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            };

            await webpush.sendNotification(pushSubscription, payload);
            sentCount++;
            success = true;
            console.log(`Sent notification to user ${sub.user_id}`);
          } catch (error: unknown) {
            const err = error as { statusCode?: number; message?: string };
            console.error(`Failed to send to ${sub.endpoint} (attempt ${retryCount + 1}):`, err.message);
            
            // Remove invalid subscriptions
            if (err.statusCode === 410 || err.statusCode === 404) {
              invalidSubscriptions.push(sub.id);
              break;
            }
            
            retryCount++;
            if (retryCount > maxRetries) {
              failedCount++;
            }
          }
        }
      }

      // Mark notification as processed
      await supabase
        .from('document_upload_notifications')
        .update({ processed: true })
        .eq('id', notification.id);
    }

    // Clean up invalid subscriptions
    if (invalidSubscriptions.length > 0) {
      console.log(`Removing ${invalidSubscriptions.length} invalid subscriptions`);
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', invalidSubscriptions);
    }

    // Update log with final counts
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
