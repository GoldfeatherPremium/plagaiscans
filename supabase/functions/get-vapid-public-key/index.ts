// Lovable Cloud Function: get-vapid-public-key
// Returns the VAPID public key for Web Push subscription (safe to expose).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // VAPID public key is safe to expose publicly - no auth required
    const key = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").trim();
    if (!key) {
      console.error("VAPID_PUBLIC_KEY is missing");
      return new Response(JSON.stringify({ error: "VAPID public key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ vapidPublicKey: key }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-vapid-public-key error:", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
