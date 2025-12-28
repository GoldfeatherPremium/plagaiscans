import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildPushHTTPRequest } from "https://esm.sh/@pushforge/builder?target=deno";

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
  targetAudience?: "all" | "customers" | "staff" | "admins" | "staff_and_admins";
  sendToAll?: boolean;
  eventType?: string;
  sentBy?: string;
}

// Base64 URL encode helper
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Base64 URL decode helper
function base64UrlDecode(input: string): Uint8Array {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getVapidPrivateJwk(vapidPublicKey: string, vapidPrivateKey: string) {
  const pub = base64UrlDecode(vapidPublicKey);
  const priv = base64UrlDecode(vapidPrivateKey);

  // VAPID public key is usually uncompressed P-256: 65 bytes (0x04 + 32-byte X + 32-byte Y)
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error(`Invalid VAPID public key format (expected 65-byte uncompressed EC point). Got length=${pub.length}`);
  }
  if (priv.length !== 32) {
    throw new Error(`Invalid VAPID private key format (expected 32 bytes). Got length=${priv.length}`);
  }

  const x = pub.slice(1, 33);
  const y = pub.slice(33, 65);

  return {
    kty: "EC",
    crv: "P-256",
    x: base64UrlEncode(x),
    y: base64UrlEncode(y),
    d: base64UrlEncode(priv),
    ext: true,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
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
      eventType = "manual",
      sentBy,
    } = payload;

    console.log("Sending push notification:", { title, body, userId, userIds, targetAudience, sendToAll, eventType });

    if (!title || !body) {
      throw new Error("Title and body are required");
    }

    // Check global push notifications toggle
    const { data: globalSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "push_notifications_enabled")
      .maybeSingle();

    if (globalSetting?.value === "false") {
      console.log("Push notifications are globally disabled");
      return new Response(
        JSON.stringify({ success: false, message: "Push notifications are globally disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check role-specific toggles based on target audience
    if (targetAudience) {
      const toggleKey = `push_${targetAudience === "all" ? "notifications" : targetAudience}_notifications_enabled`;
      const { data: audienceSetting } = await supabase
        .from("settings")
        .select("value")
        .eq("key", toggleKey)
        .maybeSingle();

      if (audienceSetting?.value === "false") {
        console.log(`Push notifications for ${targetAudience} are disabled`);
        return new Response(
          JSON.stringify({ success: false, message: `Push notifications for ${targetAudience} are disabled` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Create log entry
    const { data: logEntry, error: logError } = await supabase
      .from("push_notification_logs")
      .insert({
        event_type: eventType,
        title,
        body,
        target_audience: targetAudience || (sendToAll ? "all" : (userId ? "specific" : "multiple")),
        target_user_id: userId || null,
        sent_by: sentBy || null,
        status: "sending",
      })
      .select("id")
      .single();

    if (logError) {
      console.error("Error creating log entry:", logError);
    }

    const logId = logEntry?.id;

    // Build query for subscriptions based on targeting
    let targetUserIds: string[] = [];

    if (sendToAll) {
      console.log("Sending to all subscriptions");
      const { data: allSubs } = await supabase.from("push_subscriptions").select("user_id");
      targetUserIds = [...new Set(allSubs?.map((s) => s.user_id) || [])];
    } else if (targetAudience && targetAudience !== "all") {
      if (targetAudience === "staff_and_admins") {
        const { data: roleUsers } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["staff", "admin"]);
        targetUserIds = roleUsers?.map((r) => r.user_id) || [];
        console.log(`Found ${targetUserIds.length} staff/admin users`);
      } else {
        const roleMap: Record<string, string> = {
          customers: "customer",
          staff: "staff",
          admins: "admin",
        };
        const role = roleMap[targetAudience];

        if (role) {
          const { data: roleUsers } = await supabase.from("user_roles").select("user_id").eq("role", role);
          targetUserIds = roleUsers?.map((r) => r.user_id) || [];
        }
      }
    } else if (targetAudience === "all") {
      const { data: allSubs } = await supabase.from("push_subscriptions").select("user_id");
      targetUserIds = [...new Set(allSubs?.map((s) => s.user_id) || [])];
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
        await supabase
          .from("push_notification_logs")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", logId);
      }
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No target users found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get user notification preferences
    const { data: userPrefs } = await supabase
      .from("user_notification_preferences")
      .select("user_id, system_enabled, promotional_enabled, updates_enabled")
      .in("user_id", targetUserIds);

    const prefMap = new Map<string, boolean>();
    targetUserIds.forEach((id) => prefMap.set(id, true));

    if (eventType !== "system" && eventType !== "document_upload") {
      userPrefs?.forEach((pref) => {
        if (eventType === "promotional" && !pref.promotional_enabled) prefMap.set(pref.user_id, false);
        if (eventType === "updates" && !pref.updates_enabled) prefMap.set(pref.user_id, false);
      });
    }

    const enabledUserIds = targetUserIds.filter((id) => prefMap.get(id) === true);
    console.log(`${enabledUserIds.length} users have notifications enabled for this type`);

    const { data: subscriptions, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", enabledUserIds);

    if (fetchError) {
      console.error("Error fetching subscriptions:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${subscriptions?.length || 0} subscriptions`);

    if (!subscriptions || subscriptions.length === 0) {
      if (logId) {
        await supabase
          .from("push_notification_logs")
          .update({ status: "completed", recipient_count: 0, completed_at: new Date().toISOString() })
          .eq("id", logId);
      }
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No subscriptions found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("VAPID keys not configured");
    }

    const privateJWK = getVapidPrivateJwk(vapidPublicKey, vapidPrivateKey);

    const pushPayload = {
      title,
      body,
      icon: icon || "/pwa-icon-192.png",
      badge: badge || "/pwa-icon-192.png",
      data: {
        url: url || "/dashboard",
        ...data,
      },
    };

    let successCount = 0;
    let failureCount = 0;
    const removedSubscriptions: string[] = [];

    for (const subscription of subscriptions) {
      try {
        const { endpoint, headers, body: requestBody } = await buildPushHTTPRequest({
          privateJWK,
          subscription: {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          message: {
            adminContact: "mailto:support@plagaiscans.com",
            payload: pushPayload,
            options: {
              ttl: 86400,
              urgency: "high",
            },
          },
        });

        const res = await fetch(endpoint, {
          method: "POST",
          headers,
          body: requestBody,
        });

        if (res.ok || res.status === 201) {
          successCount++;
          continue;
        }

        // If expired / gone, remove subscription
        if (res.status === 410 || res.status === 404) {
          console.log(`Removing invalid subscription ${subscription.id} (status ${res.status})`);
          await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
          removedSubscriptions.push(subscription.id);
        }

        const errText = await res.text().catch(() => "");
        console.error(`Failed to send push to subscription ${subscription.id}: status=${res.status} body=${errText}`);
        failureCount++;
      } catch (err) {
        console.error(`Error sending push to subscription ${subscription.id}:`, err);
        failureCount++;
      }
    }

    console.log(`Push notification results: ${successCount} sent, ${failureCount} failed`);

    if (logId) {
      await supabase
        .from("push_notification_logs")
        .update({
          status: "completed",
          recipient_count: subscriptions.length,
          success_count: successCount,
          failed_count: failureCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        failed: failureCount,
        removedSubscriptions,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Error in send-push-notification:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
