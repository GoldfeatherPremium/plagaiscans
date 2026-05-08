// Cron dispatcher: assigns pending AI-scan documents to the API account with the
// most credits remaining that still has free concurrency. Skips accounts that are
// disabled, expired, out of credits, or at concurrency cap.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE = 'https://api.similaritycheck.app/api/v1';
const MAX_DOCS_PER_RUN = 30;

type Account = {
  id: string;
  label: string;
  api_token: string;
  max_concurrency: number;
  credits_remaining: number;
  free_slots: number;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let force = false;
  try {
    const body = await req.json().catch(() => ({}));
    force = Boolean(body?.force);
  } catch (_) { /* ignore */ }

  if (!force) {
    const { data: toggle } = await supabase
      .from('settings').select('value')
      .eq('key', 'external_api_auto_dispatch_enabled').maybeSingle();
    if (toggle && String(toggle.value) !== 'true') {
      return json({ ok: true, dispatched: 0, reason: 'auto-dispatch disabled' });
    }
  }

  // Load enabled accounts.
  const { data: accountsRaw } = await supabase
    .from('external_api_accounts')
    .select('id, label, api_token, max_concurrency, enabled')
    .eq('enabled', true);

  if (!accountsRaw || accountsRaw.length === 0) {
    return json({ ok: true, dispatched: 0, reason: 'no enabled accounts' });
  }

  // Probe live capacity in parallel.
  const now = Date.now();
  const probes = await Promise.all(accountsRaw.map(async (acc) => {
    try {
      const resp = await fetch(`${API_BASE}/account`, {
        headers: { Authorization: `Bearer ${acc.api_token}` },
        signal: AbortSignal.timeout(3000),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok) return { acc, skip: 'probe_failed', detail: j };

      const expiresAt = j.expiresAt ? new Date(j.expiresAt).getTime() : Infinity;
      const isActive = j.isActive !== false;
      const credits = Number(j.creditsRemaining ?? 0);
      const limit = Math.min(Number(j.concurrencyLimit ?? acc.max_concurrency), acc.max_concurrency);
      const current = Number(j.currentConcurrent ?? 0);
      const dailyLimit = j.dailyLimit == null ? null : Number(j.dailyLimit);
      const dailyUsage = j.dailyUsage == null ? 0 : Number(j.dailyUsage);

      // Snapshot back to DB (fire-and-forget).
      supabase.from('external_api_accounts').update({
        credits_remaining: credits,
        credits_total: Number(j.creditsTotal ?? null),
        concurrency_limit: Number(j.concurrencyLimit ?? null),
        current_concurrent: current,
        daily_limit: dailyLimit,
        daily_usage: dailyUsage,
        expires_at: j.expiresAt ?? null,
        is_active_remote: isActive,
        account_name: j.name ?? null,
        client_id: j.clientId ?? null,
        last_checked_at: new Date().toISOString(),
        last_probe_error: null,
      }).eq('id', acc.id).then(() => {});

      if (!isActive) return { acc, skip: 'inactive' };
      if (expiresAt < now) return { acc, skip: 'expired' };
      if (credits <= 0) return { acc, skip: 'no_credits' };
      if (dailyLimit !== null && dailyUsage >= dailyLimit) return { acc, skip: 'daily_limit' };
      const free = Math.max(0, limit - current);
      if (free <= 0) return { acc, skip: 'no_concurrency' };

      return {
        acc,
        ready: {
          id: acc.id, label: acc.label, api_token: acc.api_token,
          max_concurrency: acc.max_concurrency,
          credits_remaining: credits, free_slots: free,
        } as Account,
      };
    } catch (e) {
      return { acc, skip: 'exception', detail: e instanceof Error ? e.message : 'unknown' };
    }
  }));

  let pool: Account[] = probes.filter((p) => p.ready).map((p) => p.ready!);
  const skipped = probes.filter((p) => !p.ready).map((p) => ({ label: p.acc.label, reason: p.skip }));

  if (pool.length === 0) {
    return json({ ok: true, dispatched: 0, reason: 'no eligible account', skipped });
  }

  const totalCapacity = Math.min(MAX_DOCS_PER_RUN, pool.reduce((s, a) => s + Math.min(a.free_slots, a.credits_remaining), 0));

  const { data: candidates, error } = await supabase
    .from('documents')
    .select('id')
    .in('status', ['pending', 'in_progress'])
    .is('external_api_order_id', null)
    .or('external_api_status.is.null,external_api_status.in.(submit_failed,rate_limited)')
    .neq('deleted_by_user', true)
    .is('cancelled_at', null)
    .or('scan_type.is.null,scan_type.neq.similarity_only')
    .order('uploaded_at', { ascending: true })
    .limit(totalCapacity);

  if (error) return json({ error: error.message }, 500);
  if (!candidates || candidates.length === 0) {
    return json({ ok: true, dispatched: 0, pool: pool.map(a => ({ label: a.label, credits: a.credits_remaining, slots: a.free_slots })), skipped });
  }

  // Assign each doc to the account with highest credits_remaining; decrement locally.
  const assignments: { documentId: string; account: Account }[] = [];
  for (const c of candidates) {
    pool = pool.filter(a => a.free_slots > 0 && a.credits_remaining > 0)
               .sort((a, b) => b.credits_remaining - a.credits_remaining);
    if (pool.length === 0) break;
    const top = pool[0];
    assignments.push({ documentId: c.id, account: top });
    top.free_slots -= 1;
    top.credits_remaining -= 1;
  }

  await Promise.all(assignments.map((a) =>
    supabase.from('documents').update({
      external_api_status: 'queued',
      external_api_error: null,
      external_api_account_id: a.account.id,
    }).eq('id', a.documentId)
  ));

  const dispatchPromise = dispatchAll(supabaseUrl, serviceKey, assignments);
  const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(dispatchPromise);
  else dispatchPromise.catch(() => undefined);

  // Per-account assignment summary.
  const summary: Record<string, number> = {};
  for (const a of assignments) summary[a.account.label] = (summary[a.account.label] ?? 0) + 1;

  return json({ ok: true, dispatched: assignments.length, by_account: summary, skipped }, 202);
});

async function dispatchAll(supabaseUrl: string, serviceKey: string, assignments: { documentId: string; account: Account }[]) {
  await Promise.all(assignments.map(async (a) => {
    try {
      await fetch(`${supabaseUrl}/functions/v1/external-api-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ documentId: a.documentId }),
      });
    } catch (_) { /* swallowed */ }
  }));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
