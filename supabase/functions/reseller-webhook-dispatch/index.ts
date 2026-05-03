// Sends a webhook to a reseller when a scan completes/fails.
// Called from external-api-poll on completion, and from reseller-webhook-retry for retries.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RETRY_DELAYS_MIN = [1, 5, 30, 120, 720]; // 1m, 5m, 30m, 2h, 12h
const MAX_ATTEMPTS = 5;

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const body = await req.json().catch(() => ({}));
  const scanId = body?.scanId;
  if (!scanId) return new Response(JSON.stringify({ error: 'scanId required' }), { status: 400, headers: corsHeaders });

  const { data: scan } = await supabase
    .from('reseller_scans')
    .select('id, reseller_id, external_reference, file_name, status, ai_percentage, ai_report_path, similarity_percentage, similarity_report_path, error, webhook_attempts, webhook_delivered, completed_at')
    .eq('id', scanId)
    .maybeSingle();

  if (!scan) return new Response(JSON.stringify({ error: 'Scan not found' }), { status: 404, headers: corsHeaders });
  if (scan.webhook_delivered) return new Response(JSON.stringify({ ok: true, already_delivered: true }), { headers: corsHeaders });

  const { data: reseller } = await supabase
    .from('resellers')
    .select('id, webhook_url, webhook_secret')
    .eq('id', scan.reseller_id)
    .maybeSingle();

  if (!reseller || !reseller.webhook_url) {
    // No webhook configured — mark as delivered (nothing to do)
    await supabase.from('reseller_scans').update({ webhook_delivered: true }).eq('id', scan.id);
    return new Response(JSON.stringify({ ok: true, no_webhook: true }), { headers: corsHeaders });
  }

  // Build signed report URLs if available
  let ai_report_url: string | null = null;
  let similarity_report_url: string | null = null;
  if (scan.status === 'completed' && scan.ai_report_path) {
    const { data: signed } = await supabase.storage.from('reports').createSignedUrl(scan.ai_report_path, 7 * 24 * 3600);
    ai_report_url = signed?.signedUrl ?? null;
  }
  if (scan.status === 'completed' && scan.similarity_report_path) {
    const { data: signed } = await supabase.storage.from('reports').createSignedUrl(scan.similarity_report_path, 7 * 24 * 3600);
    similarity_report_url = signed?.signedUrl ?? null;
  }

  const payload = {
    event: scan.status === 'completed' ? 'scan.completed' : 'scan.failed',
    scan_id: scan.id,
    external_reference: scan.external_reference,
    file_name: scan.file_name,
    status: scan.status,
    ai_percentage: scan.ai_percentage,
    similarity_percentage: scan.similarity_percentage,
    error: scan.error,
    // Backward-compatible alias for resellers already consuming `report_url` (AI report)
    report_url: ai_report_url,
    ai_report_url,
    similarity_report_url,
    completed_at: scan.completed_at,
    timestamp: new Date().toISOString(),
  };

  const rawBody = JSON.stringify(payload);
  const signature = await hmacSha256Hex(reseller.webhook_secret, rawBody);
  const attemptNumber = (scan.webhook_attempts ?? 0) + 1;

  let succeeded = false;
  let responseStatus: number | null = null;
  let responseBody = '';
  let error: string | null = null;

  try {
    const resp = await fetch(reseller.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PlagaiScans-Signature': `sha256=${signature}`,
        'X-PlagaiScans-Event': payload.event,
        'X-PlagaiScans-Delivery': crypto.randomUUID(),
      },
      body: rawBody,
      signal: AbortSignal.timeout(15_000),
    });
    responseStatus = resp.status;
    responseBody = (await resp.text().catch(() => '')).slice(0, 2000);
    succeeded = resp.ok;
    if (!succeeded) error = `HTTP ${resp.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : 'unknown';
  }

  await supabase.from('reseller_webhook_logs').insert({
    reseller_id: reseller.id,
    scan_id: scan.id,
    url: reseller.webhook_url,
    payload,
    response_status: responseStatus,
    response_body: responseBody,
    attempt_number: attemptNumber,
    succeeded,
    error,
  });

  if (succeeded) {
    await supabase.from('reseller_scans').update({
      webhook_delivered: true,
      webhook_attempts: attemptNumber,
      webhook_next_retry_at: null,
    }).eq('id', scan.id);
  } else {
    let nextRetry: string | null = null;
    if (attemptNumber < MAX_ATTEMPTS) {
      const mins = RETRY_DELAYS_MIN[attemptNumber - 1] ?? 720;
      nextRetry = new Date(Date.now() + mins * 60_000).toISOString();
    }
    await supabase.from('reseller_scans').update({
      webhook_attempts: attemptNumber,
      webhook_next_retry_at: nextRetry,
    }).eq('id', scan.id);
  }

  return new Response(JSON.stringify({ ok: succeeded, attempt: attemptNumber, response_status: responseStatus }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
