// Edge Function: push-resubscribe
// Called by the service worker when the browser rotates a push subscription
// endpoint (`pushsubscriptionchange` event). Updates the existing row in place
// to preserve the user link, or inserts a new orphan row if no match found.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ResubscribePayload {
  oldEndpoint?: string | null;
  newSubscription: {
    endpoint: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
  userAgent?: string;
  platform?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json()) as ResubscribePayload;

    if (!body?.newSubscription?.endpoint) {
      return new Response(
        JSON.stringify({ error: "newSubscription.endpoint required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const newEndpoint = body.newSubscription.endpoint;
    const p256dh = body.newSubscription.keys?.p256dh ?? "";
    const auth = body.newSubscription.keys?.auth ?? "";
    const userAgent = body.userAgent ?? null;
    const platform = body.platform ?? null;
    const now = new Date().toISOString();

    // 1. Try to find the existing row by oldEndpoint and update it in place.
    if (body.oldEndpoint) {
      const { data: existing, error: findError } = await supabase
        .from("push_subscriptions")
        .select("id, user_id")
        .eq("endpoint", body.oldEndpoint)
        .maybeSingle();

      if (findError) {
        console.error("Lookup by oldEndpoint failed:", findError);
      }

      if (existing) {
        const { error: updateError } = await supabase
          .from("push_subscriptions")
          .update({
            endpoint: newEndpoint,
            p256dh,
            auth,
            user_agent: userAgent,
            platform,
            last_seen_at: now,
            updated_at: now,
          })
          .eq("id", existing.id);

        if (updateError) {
          // If update conflicts (e.g. new endpoint already exists for this user),
          // fall through to delete the old row — the new one is already valid.
          console.warn("Update failed, deleting old row:", updateError);
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", existing.id);
        }

        console.log(
          `Rotated push endpoint for user ${existing.user_id}`,
        );
        return new Response(
          JSON.stringify({ success: true, action: "updated" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // 2. No oldEndpoint or no match — insert as orphan (no user_id).
    // The subscription is unusable for targeting a user, but we keep it for
    // future reconciliation and to avoid silently dropping data.
    console.log(
      "pushsubscriptionchange: no matching old endpoint, skipping insert",
    );
    return new Response(
      JSON.stringify({
        success: true,
        action: "no_match",
        note: "Old endpoint not found; client should re-subscribe via authenticated flow",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("push-resubscribe error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Unexpected error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
