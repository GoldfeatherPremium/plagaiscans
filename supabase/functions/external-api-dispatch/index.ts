// Cron dispatcher: finds pending AI-scan-queue documents that haven't been submitted
// to the external API yet and assigns them across multiple API accounts based on free capacity.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE = 'https://api.similaritycheck.app/api/v1';
const MAX_BATCH_PER_ACCOUNT = 10;

type Account = { id: string; label: string; api_token: string; max_concurrency: number };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const fallbackToken = Deno.env.get('SIMILARITYCHECK_API_TOKEN');

  const supabase = createClient(supabaseUrl, serviceKey);

  let force = false;
  try {
    const body = await req.json().catch(() => ({}));
    force = Boolean(body?.force);
  } catch (_) { /* ignore */ }

  if (!force) {
    const { data: toggle } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'external_api_auto_dispatch_enabled')
      .maybeSingle();
    if (toggle && String(toggle.value) !== 'true') {
      return json({ ok: true, dispatched: 0, reason: 'auto-dispatch disabled' });
    }
  }

  // Load enabled accounts; fall back to env-token single account if table empty.
  const { data: accountsRaw } = await supabase
    .from('external_api_accounts')
    .select('id, label, api_token, max_concurrency')
    .eq('enabled', true);

  let accounts: Account[] = (accountsRaw ?? []) as Account[];
  if (accounts.length === 0 && fallbackToken) {
    accounts = [{ id: '', label: 'env-fallback', api_token: fallbackToken, max_concurrency: 4 }];
  }
  if (accounts.length === 0) return json({ error: 'no API accounts configured' }, 500);

  // Probe each account in parallel for free capacity.
  const capacities = await Promise.all(accounts.map(async (acc) => {
    let cap = Math.min(MAX_BATCH_PER_ACCOUNT, acc.max_concurrency);
    try {
      const resp = await fetch(`${API_BASE}/account`, {
        headers: { Authorization: `Bearer ${acc.api_token}` },
        signal: AbortSignal.timeout(3000),
      });
      if (resp.ok) {
        const j = await resp.json();
        const limit = Number(j?.concurrencyLimit ?? acc.max_concurrency);
        const current = Number(j?.currentConcurrent ?? 0);
        cap = Math.max(0, Math.min(MAX_BATCH_PER_ACCOUNT, Math.min(limit, acc.max_concurrency) - current));
      }
    } catch (_) { /* ignore */ }
    return { account: acc, capacity: cap };
  }));

  const totalCapacity = capacities.reduce((sum, c) => sum + c.capacity, 0);
  if (totalCapacity <= 0) return json({ ok: true, dispatched: 0, reason: 'no capacity', capacities: capacities.map(c => ({ label: c.account.label, capacity: c.capacity })) });

  // Find candidates
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
  if (!candidates || candidates.length === 0) return json({ ok: true, dispatched: 0 });

  // Assign documents round-robin / fill-by-capacity across accounts.
  const assignments: { documentId: string; account: Account }[] = [];
  let cursor = 0;
  for (const slot of capacities) {
    const take = candidates.slice(cursor, cursor + slot.capacity);
    cursor += slot.capacity;
    for (const c of take) assignments.push({ documentId: c.id, account: slot.account });
    if (cursor >= candidates.length) break;
  }

  // Mark queued + assigned account.
  await Promise.all(assignments.map((a) =>
    supabase.from('documents').update({
      external_api_status: 'queued',
      external_api_error: null,
      external_api_account_id: a.account.id || null,
    }).eq('id', a.documentId)
  ));

  const dispatchPromise = dispatchAll(supabaseUrl, serviceKey, assignments);
  const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(dispatchPromise);
  else dispatchPromise.catch(() => undefined);

  return json({
    ok: true,
    dispatched: assignments.length,
    by_account: capacities.map((c) => ({
      label: c.account.label,
      capacity: c.capacity,
      assigned: assignments.filter(a => a.account.id === c.account.id).length,
    })),
  }, 202);
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
