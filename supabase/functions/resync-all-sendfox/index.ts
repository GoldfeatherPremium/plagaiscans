// Admin-triggered: paginate every profile and invoke sync-contact-to-sendfox
// at ~10 calls/second to respect SendFox rate limits.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function isAdmin(authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data } = await userClient.auth.getUser();
  if (!data?.user) return false;
  const { data: hasRole } = await supabase.rpc('has_role', {
    _user_id: data.user.id,
    _role: 'admin',
  });
  return Boolean(hasRole);
}

async function invokeSync(userId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-contact-to-sendfox`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: `${res.status}: ${t.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    if (!(await isAdmin(req.headers.get('Authorization')))) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const PAGE_SIZE = 100;
    let from = 0;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    // EdgeRuntime keeps the function alive for the long-running job;
    // the response returns immediately so the admin UI doesn't hang.
    const runJob = async () => {
      while (true) {
        const { data: rows, error } = await supabase
          .from('profiles')
          .select('id')
          .order('created_at', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          console.error('resync pagination error', error);
          break;
        }
        if (!rows || rows.length === 0) break;

        // Process this page in batches of 10 with a 1s gap between batches.
        for (let i = 0; i < rows.length; i += 10) {
          const slice = rows.slice(i, i + 10);
          const results = await Promise.all(
            slice.map((r: any) => invokeSync(r.id)),
          );
          processed += results.length;
          succeeded += results.filter((r) => r.ok).length;
          failed += results.filter((r) => !r.ok).length;
          if (i + 10 < rows.length || rows.length === PAGE_SIZE) {
            await new Promise((res) => setTimeout(res, 1000));
          }
        }

        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      await supabase.from('sendfox_sync_log').insert({
        action: 'resync_all',
        status: failed === 0 ? 'success' : 'failed',
        error: failed === 0
          ? null
          : `processed=${processed} succeeded=${succeeded} failed=${failed}`,
      });
      console.log(`resync-all complete: ${succeeded}/${processed} (failed=${failed})`);
    };

    // @ts-ignore — Deno EdgeRuntime
    if (typeof EdgeRuntime !== 'undefined' && (EdgeRuntime as any).waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(runJob());
    } else {
      runJob().catch((e) => console.error('runJob error', e));
    }

    return new Response(
      JSON.stringify({ ok: true, message: 'Resync started in background' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
