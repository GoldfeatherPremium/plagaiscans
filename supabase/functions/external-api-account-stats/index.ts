// Probes /account on every enabled external API account and saves a snapshot
// to the external_api_accounts table. Also auto-migrates the env-stored token
// into the table on first run if it isn't already present.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE = 'https://api.similaritycheck.app/api/v1';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const envToken = Deno.env.get('SIMILARITYCHECK_API_TOKEN');
  const supabase = createClient(supabaseUrl, serviceKey);

  // Auto-migrate env token if missing.
  if (envToken) {
    const { data: existing } = await supabase
      .from('external_api_accounts')
      .select('id')
      .eq('api_token', envToken)
      .maybeSingle();
    if (!existing) {
      await supabase.from('external_api_accounts').insert({
        label: 'Primary (env)',
        api_token: envToken,
        max_concurrency: 5,
        enabled: true,
        notes: 'Migrated from SIMILARITYCHECK_API_TOKEN secret',
      });
    }
  }

  const { data: accounts, error } = await supabase
    .from('external_api_accounts')
    .select('id, label, api_token');

  if (error) return json({ error: error.message }, 500);
  if (!accounts || accounts.length === 0) return json({ ok: true, probed: 0 });

  const results = await Promise.all(accounts.map(async (acc) => {
    try {
      const resp = await fetch(`${API_BASE}/account`, {
        headers: { Authorization: `Bearer ${acc.api_token}` },
        signal: AbortSignal.timeout(5000),
      });
      const j = await resp.json().catch(() => ({}));
      const update = resp.ok ? {
        credits_remaining: numOrNull(j.creditsRemaining),
        credits_total: numOrNull(j.creditsTotal),
        concurrency_limit: numOrNull(j.concurrencyLimit),
        current_concurrent: numOrNull(j.currentConcurrent),
        daily_limit: numOrNull(j.dailyLimit),
        daily_usage: numOrNull(j.dailyUsage),
        expires_at: j.expiresAt ?? null,
        is_active_remote: typeof j.isActive === 'boolean' ? j.isActive : null,
        account_name: j.name ?? null,
        client_id: j.clientId ?? null,
        last_checked_at: new Date().toISOString(),
        last_probe_error: null,
      } : {
        last_checked_at: new Date().toISOString(),
        last_probe_error: `HTTP ${resp.status}: ${j?.error ?? 'probe failed'}`,
      };
      await supabase.from('external_api_accounts').update(update).eq('id', acc.id);
      return { id: acc.id, label: acc.label, ok: resp.ok };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      await supabase.from('external_api_accounts').update({
        last_checked_at: new Date().toISOString(),
        last_probe_error: msg,
      }).eq('id', acc.id);
      return { id: acc.id, label: acc.label, ok: false, error: msg };
    }
  }));

  return json({ ok: true, probed: results.length, results });
});

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
