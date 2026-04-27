// SendFox webhook receiver. Verifies shared secret, mirrors unsubscribes,
// bounces, and complaints into the local promotional suppression list.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);
const WEBHOOK_SECRET = Deno.env.get('SENDFOX_WEBHOOK_SECRET') ?? '';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (!WEBHOOK_SECRET) {
    return new Response('Webhook not configured', { status: 500, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const provided =
    req.headers.get('x-webhook-secret') ?? url.searchParams.get('secret');
  if (provided !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  try {
    const event = await req.json().catch(() => ({}));

    const email = String(
      event.email ?? event.data?.email ?? event.contact?.email ?? '',
    ).toLowerCase().trim();
    const type = String(event.event ?? event.type ?? '').toLowerCase();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let reason: string | null = null;
    if (type.includes('unsubscribe')) reason = 'user_unsubscribe';
    else if (type.includes('bounce')) reason = 'bounce';
    else if (type.includes('complaint') || type.includes('spam')) reason = 'complaint';

    if (reason) {
      await supabase
        .from('email_suppressions')
        .upsert(
          { email, reason, source: 'sendfox' },
          { onConflict: 'email' },
        );
      await supabase.from('sendfox_sync_log').insert({
        email,
        action: reason,
        status: 'success',
      });
    } else {
      await supabase.from('sendfox_sync_log').insert({
        email,
        action: `ignored:${type || 'unknown'}`,
        status: 'success',
      });
    }

    return new Response(JSON.stringify({ ok: true, reason }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('sendfox-webhook error', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
