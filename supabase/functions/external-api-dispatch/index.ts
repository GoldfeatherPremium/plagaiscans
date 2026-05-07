// Cron dispatcher: finds pending AI-scan-queue documents that haven't been submitted
// to the external API yet and submits them, respecting concurrency.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE = 'https://api.similaritycheck.app/api/v1';
const MAX_BATCH = 10;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const apiToken = Deno.env.get('SIMILARITYCHECK_API_TOKEN');
  if (!apiToken) return json({ error: 'SIMILARITYCHECK_API_TOKEN not configured' }, 500);

  const supabase = createClient(supabaseUrl, serviceKey);

  // Allow manual force-run to bypass toggle
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

  // Check account capacity
  let capacity = MAX_BATCH;
  try {
    const acctResp = await fetch(`${API_BASE}/account`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      signal: AbortSignal.timeout(3000),
    });
    if (acctResp.ok) {
      const acct = await acctResp.json();
      const limit = Number(acct?.concurrencyLimit ?? 0);
      const current = Number(acct?.currentConcurrent ?? 0);
      if (limit > 0) capacity = Math.max(0, Math.min(MAX_BATCH, limit - current));
    }
  } catch (_) { /* ignore */ }

  if (capacity <= 0) return json({ ok: true, dispatched: 0, reason: 'no capacity' });

  // Find candidates: AI scan queue docs (scan_type != similarity_only) with no order id yet,
  // not deleted/cancelled.
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
    .limit(capacity);

  if (error) return json({ error: error.message }, 500);
  if (!candidates || candidates.length === 0) return json({ ok: true, dispatched: 0 });

  await supabase
    .from('documents')
    .update({ external_api_status: 'queued', external_api_error: null })
    .in('id', candidates.map((c) => c.id));

  const dispatchPromise = dispatchCandidates(supabaseUrl, serviceKey, candidates.map((c) => c.id));
  const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(dispatchPromise);
  } else {
    dispatchPromise.catch(() => undefined);
  }

  return json({ ok: true, dispatched: candidates.length, queued: candidates.map((c) => c.id) }, 202);
});

async function dispatchCandidates(supabaseUrl: string, serviceKey: string, ids: string[]) {
  await Promise.all(ids.map(async (id) => {
    try {
      await fetch(`${supabaseUrl}/functions/v1/external-api-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ documentId: id }),
      });
    } catch (_) { /* external-api-submit records document-level failures when reached */ }
  }));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
