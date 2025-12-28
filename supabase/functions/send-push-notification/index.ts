import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  data?: Record<string, unknown>;
  userId?: string;
  userIds?: string[];
  targetAudience?: 'all' | 'customers' | 'staff' | 'admins' | 'staff_and_admins';
  sendToAll?: boolean;
  eventType?: string;
  sentBy?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const payload: PushPayload = await req.json();
    const { 
      title, 
      body, 
      icon, 
      badge, 
      url,
      data, 
      userId, 
      userIds, 
      targetAudience,
      sendToAll,
      eventType = 'manual',
      sentBy
    } = payload;

    console.log("Sending push notification:", { title, body, userId, userIds, targetAudience, sendToAll, eventType });

    if (!title || !body) {
      throw new Error("Title and body are required");
    }

    // Check global push notifications toggle
    const { data: globalSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'push_notifications_enabled')
      .maybeSingle();

    if (globalSetting?.value === 'false') {
      console.log('Push notifications are globally disabled');
      return new Response(
        JSON.stringify({ success: false, message: "Push notifications are globally disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check role-specific toggles based on target audience
    if (targetAudience) {
      const toggleKey = `push_${targetAudience === 'all' ? 'notifications' : targetAudience}_notifications_enabled`;
      const { data: audienceSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', toggleKey)
        .maybeSingle();

      if (audienceSetting?.value === 'false') {
        console.log(`Push notifications for ${targetAudience} are disabled`);
        return new Response(
          JSON.stringify({ success: false, message: `Push notifications for ${targetAudience} are disabled` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create log entry
    const { data: logEntry, error: logError } = await supabase
      .from('push_notification_logs')
      .insert({
        event_type: eventType,
        title,
        body,
        target_audience: targetAudience || (sendToAll ? 'all' : (userId ? 'specific' : 'multiple')),
        target_user_id: userId || null,
        sent_by: sentBy || null,
        status: 'sending',
      })
      .select('id')
      .single();

    if (logError) {
      console.error("Error creating log entry:", logError);
    }

    const logId = logEntry?.id;

    // Build query for subscriptions based on targeting
    let targetUserIds: string[] = [];

    if (sendToAll) {
      console.log("Sending to all subscriptions");
      // Get all user IDs with subscriptions
      const { data: allSubs } = await supabase
        .from('push_subscriptions')
        .select('user_id');
      targetUserIds = [...new Set(allSubs?.map(s => s.user_id) || [])];
    } else if (targetAudience && targetAudience !== 'all') {
      // Get users by role
      if (targetAudience === 'staff_and_admins') {
        // Get both staff and admin users
        const { data: roleUsers } = await supabase
          .from('user_roles')
          .select('user_id')
          .in('role', ['staff', 'admin']);
        targetUserIds = roleUsers?.map(r => r.user_id) || [];
        console.log(`Found ${targetUserIds.length} staff/admin users`);
      } else {
        const roleMap: Record<string, string> = {
          'customers': 'customer',
          'staff': 'staff',
          'admins': 'admin'
        };
        const role = roleMap[targetAudience];
        
        if (role) {
          const { data: roleUsers } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', role);
          targetUserIds = roleUsers?.map(r => r.user_id) || [];
        }
      }
    } else if (targetAudience === 'all') {
      const { data: allSubs } = await supabase
        .from('push_subscriptions')
        .select('user_id');
      targetUserIds = [...new Set(allSubs?.map(s => s.user_id) || [])];
    } else if (userIds && userIds.length > 0) {
      targetUserIds = userIds;
    } else if (userId) {
      targetUserIds = [userId];
    } else {
      throw new Error("Must specify userId, userIds, targetAudience, or sendToAll");
    }

    if (targetUserIds.length === 0) {
      console.log("No target users found");
      if (logId) {
        await supabase.from('push_notification_logs').update({ 
          status: 'completed', 
          completed_at: new Date().toISOString() 
        }).eq('id', logId);
      }
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No target users found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user notification preferences - respect individual opt-out
    const { data: userPrefs } = await supabase
      .from('user_notification_preferences')
      .select('user_id, system_enabled, promotional_enabled, updates_enabled')
      .in('user_id', targetUserIds);

    // Filter users based on their preferences (system notifications always go through)
    const prefMap = new Map<string, boolean>();
    targetUserIds.forEach(id => prefMap.set(id, true)); // Default enabled
    
    // For non-system notifications, check user preferences
    if (eventType !== 'system' && eventType !== 'document_upload') {
      userPrefs?.forEach(pref => {
        if (eventType === 'promotional' && !pref.promotional_enabled) {
          prefMap.set(pref.user_id, false);
        }
        if (eventType === 'updates' && !pref.updates_enabled) {
          prefMap.set(pref.user_id, false);
        }
      });
    }

    const enabledUserIds = targetUserIds.filter(id => prefMap.get(id) === true);
    console.log(`${enabledUserIds.length} users have notifications enabled for this type`);

    // Get subscriptions for enabled users
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', enabledUserIds);

    if (fetchError) {
      console.error("Error fetching subscriptions:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions`);

    if (!subscriptions || subscriptions.length === 0) {
      if (logId) {
        await supabase.from('push_notification_logs').update({ 
          status: 'completed',
          recipient_count: 0,
          completed_at: new Date().toISOString()
        }).eq('id', logId);
      }
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscriptions found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("VAPID keys not configured");
    }

    const notificationPayload = JSON.stringify({
      title,
      body,
      icon: icon || "/pwa-icon-192.png",
      badge: badge || "/pwa-icon-192.png",
      data: {
        url: url || '/dashboard',
        ...data,
      },
    });

    let successCount = 0;
    let failureCount = 0;
    const failedSubscriptions: string[] = [];

    // Dynamic import of web-push
    const webpush = await import("https://esm.sh/web-push@3.6.7");

    webpush.setVapidDetails(
      "mailto:support@plagaiscans.com",
      vapidPublicKey,
      vapidPrivateKey
    );

    // Send to each subscription with retry logic
    for (const subscription of subscriptions) {
      let retryCount = 0;
      const maxRetries = 1;
      let success = false;

      while (retryCount <= maxRetries && !success) {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          };

          await webpush.sendNotification(pushSubscription, notificationPayload);
          successCount++;
          success = true;
          console.log(`Push sent successfully to subscription ${subscription.id}`);
        } catch (err: unknown) {
          const error = err as { statusCode?: number; message?: string };
          console.error(`Error sending push to subscription ${subscription.id} (attempt ${retryCount + 1}):`, error.message);
          
          // Check if subscription is no longer valid
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`Removing invalid subscription ${subscription.id}`);
            await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
            failedSubscriptions.push(subscription.id);
            break; // Don't retry for invalid subscriptions
          }
          
          retryCount++;
          if (retryCount > maxRetries) {
            failureCount++;
          }
        }
      }
    }

    console.log(`Push notification results: ${successCount} sent, ${failureCount} failed`);

    // Update log entry
    if (logId) {
      await supabase.from('push_notification_logs').update({
        status: 'completed',
        recipient_count: subscriptions.length,
        success_count: successCount,
        failed_count: failureCount,
        completed_at: new Date().toISOString(),
      }).eq('id', logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failureCount,
        removedSubscriptions: failedSubscriptions,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Error in send-push-notification:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
