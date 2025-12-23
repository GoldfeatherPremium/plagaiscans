import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CustomerNotificationPayload {
  userId: string;
  type: 'credits_added' | 'document_ready' | 'report_uploaded' | 'system';
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
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

    const payload: CustomerNotificationPayload = await req.json();
    const { userId, type, title, body, url, data } = payload;

    console.log("Sending customer notification:", { userId, type, title });

    if (!userId || !type || !title || !body) {
      throw new Error("userId, type, title, and body are required");
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

    // Check customer notifications toggle
    const { data: customerSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'push_customer_notifications_enabled')
      .maybeSingle();

    if (customerSetting?.value === 'false') {
      console.log('Customer notifications are disabled');
      return new Response(
        JSON.stringify({ success: false, message: "Customer notifications are disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user's notification preferences
    const { data: userPrefs } = await supabase
      .from('user_notification_preferences')
      .select('system_enabled')
      .eq('user_id', userId)
      .maybeSingle();

    // Default to enabled if no preference set
    const isEnabled = userPrefs?.system_enabled !== false;

    if (!isEnabled) {
      console.log(`User ${userId} has system notifications disabled`);
      return new Response(
        JSON.stringify({ success: false, message: "User has notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
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

    // Create log entry
    await supabase.from('push_notification_logs').insert({
      event_type: type,
      title,
      body,
      target_audience: 'specific',
      target_user_id: userId,
      recipient_count: subscriptions.length,
      status: 'sending',
    });

    const notificationPayload = JSON.stringify({
      title,
      body,
      icon: "/pwa-icon-192.png",
      badge: "/pwa-icon-192.png",
      data: {
        url: url || '/dashboard',
        type,
        ...data,
      },
    });

    // Dynamic import of web-push
    const webpush = await import("https://esm.sh/web-push@3.6.7");

    webpush.setVapidDetails(
      "mailto:support@plagaiscans.com",
      vapidPublicKey,
      vapidPrivateKey
    );

    let successCount = 0;
    let failedCount = 0;
    const invalidSubscriptions: string[] = [];

    // Send to each subscription with retry
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

          await webpush.sendNotification(pushSubscription, notificationPayload);
          successCount++;
          success = true;
          console.log(`Push sent successfully to subscription ${sub.id}`);
        } catch (err: unknown) {
          const error = err as { statusCode?: number; message?: string };
          console.error(`Error sending push (attempt ${retryCount + 1}):`, error.message);
          
          if (error.statusCode === 410 || error.statusCode === 404) {
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

    // Clean up invalid subscriptions
    if (invalidSubscriptions.length > 0) {
      console.log(`Removing ${invalidSubscriptions.length} invalid subscriptions`);
      await supabase.from("push_subscriptions").delete().in("id", invalidSubscriptions);
    }

    console.log(`Customer notification results: ${successCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failedCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Error in send-customer-notification:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
