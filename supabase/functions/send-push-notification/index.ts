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
  data?: Record<string, unknown>;
  userId?: string;
  userIds?: string[];
  sendToAll?: boolean;
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

    const { title, body, icon, badge, data, userId, userIds, sendToAll }: PushPayload = await req.json();

    console.log("Sending push notification:", { title, body, userId, userIds, sendToAll });

    if (!title || !body) {
      throw new Error("Title and body are required");
    }

    // Build query for subscriptions
    let query = supabase.from("push_subscriptions").select("*");

    if (sendToAll) {
      console.log("Sending to all subscriptions");
    } else if (userIds && userIds.length > 0) {
      query = query.in("user_id", userIds);
    } else if (userId) {
      query = query.eq("user_id", userId);
    } else {
      throw new Error("Must specify userId, userIds, or sendToAll");
    }

    const { data: subscriptions, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching subscriptions:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions`);

    if (!subscriptions || subscriptions.length === 0) {
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

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || "/pwa-icon-192.png",
      badge: badge || "/pwa-icon-192.png",
      data: data || {},
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

    // Send to each subscription
    for (const subscription of subscriptions) {
      try {
        const pushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        };

        await webpush.sendNotification(pushSubscription, payload);
        successCount++;
        console.log(`Push sent successfully to subscription ${subscription.id}`);
      } catch (err: any) {
        console.error(`Error sending push to subscription ${subscription.id}:`, err);
        
        // Check if subscription is no longer valid
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`Removing invalid subscription ${subscription.id}`);
          await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
          failedSubscriptions.push(subscription.id);
        }
        failureCount++;
      }
    }

    console.log(`Push notification results: ${successCount} sent, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failureCount,
        removedSubscriptions: failedSubscriptions,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
