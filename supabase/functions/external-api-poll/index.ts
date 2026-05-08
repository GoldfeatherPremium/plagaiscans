// Polls the external API for all in-flight documents and finalises completed/failed ones.
// Cron runs every minute.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const API_BASE = 'https://api.similaritycheck.app/api/v1';
const REPORTS_BUCKET = 'reports';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const fallbackToken = Deno.env.get('SIMILARITYCHECK_API_TOKEN');

  const supabase = createClient(supabaseUrl, serviceKey);

  // Optional manual single-document poll
  let onlyDocumentId: string | null = null;
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    onlyDocumentId = body?.documentId ?? null;
  }

  const SELECT_COLS = 'id, file_name, user_id, scan_type, external_api_order_id, external_api_status, external_api_attempt_count, status, reseller_scan_id, magic_link_id';
  let query = supabase
    .from('documents')
    .select(SELECT_COLS)
    .not('external_api_order_id', 'is', null)
    .in('external_api_status', ['submitted', 'processing', 'queued'])
    .limit(50);

  if (onlyDocumentId) {
    query = supabase
      .from('documents')
      .select(SELECT_COLS)
      .eq('id', onlyDocumentId);
  }

  const { data: docs, error } = await query;
  if (error) return json({ error: error.message }, 500);
  if (!docs || docs.length === 0) return json({ ok: true, polled: 0 });

  const results: Array<Record<string, unknown>> = [];
  for (const doc of docs) {
    if (!doc.external_api_order_id) continue;
    try {
      const apiResp = await fetch(`${API_BASE}/documents/${doc.external_api_order_id}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const data = await apiResp.json().catch(() => ({}));

      await logEvent(supabase, doc.id, doc.external_api_order_id, 'poll', apiResp.ok ? 'success' : 'error', apiResp.status, null, data, apiResp.ok ? null : (data?.error || `HTTP ${apiResp.status}`));

      if (!apiResp.ok) {
        await supabase.from('documents').update({
          external_api_last_polled_at: new Date().toISOString(),
          external_api_error: `${data?.code ?? `HTTP ${apiResp.status}`}: ${data?.error ?? 'poll failed'}`,
        }).eq('id', doc.id);
        results.push({ id: doc.id, status: 'poll_error' });
        continue;
      }

      const remoteStatus: string = data.status ?? 'unknown';

      if (remoteStatus === 'queued' || remoteStatus === 'processing' || remoteStatus === 'submitted') {
        await supabase.from('documents').update({
          external_api_status: remoteStatus,
          external_api_last_polled_at: new Date().toISOString(),
          external_api_error: null,
        }).eq('id', doc.id);
        results.push({ id: doc.id, status: remoteStatus });
        continue;
      }

      if (remoteStatus === 'completed') {
        const finalised = await finaliseCompleted(supabase, apiToken, doc, data);
        await handleResellerHook(
          supabase,
          doc,
          'completed',
          (finalised as any).aiPath ?? null,
          typeof data.aiScore === 'number' ? Math.round(data.aiScore * 100) : null,
          (finalised as any).similarityPath ?? null,
          typeof data.similarityScore === 'number' ? Math.round(data.similarityScore) : null,
          null,
        );

        // Skip customer/guest emails for reseller-originated scans
        if (!doc.reseller_scan_id) {
          if (doc.user_id) {
            try {
              await fetch(`${supabaseUrl}/functions/v1/send-completion-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({
                  documentId: doc.id,
                  userId: doc.user_id,
                  fileName: doc.file_name,
                }),
              });
            } catch (e) {
              console.error('Completion email failed:', e);
            }
          }
          if ((doc as any).magic_link_id) {
            try {
              await fetch(`${supabaseUrl}/functions/v1/send-guest-completion-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({
                  documentId: doc.id,
                  fileName: doc.file_name,
                }),
              });
            } catch (e) {
              console.error('Guest completion email failed:', e);
            }
          }
        }

        results.push({ id: doc.id, status: 'completed', ...finalised });
        continue;
      }

      // failed_invalid -> mark error, no refund
      // error -> system error, refund credit if not already
      if (remoteStatus === 'failed_invalid' || remoteStatus === 'error') {
        await handleFailure(supabase, doc, remoteStatus, data);
        await handleResellerHook(supabase, doc, 'failed', null, null, null, null, (data?.error as string) ?? remoteStatus);
        results.push({ id: doc.id, status: remoteStatus });
        continue;
      }

      results.push({ id: doc.id, status: 'unknown', remote: remoteStatus });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      await logEvent(supabase, doc.id, doc.external_api_order_id, 'poll', 'error', null, null, null, msg);
      results.push({ id: doc.id, status: 'exception', error: msg });
    }
  }

  return json({ ok: true, polled: docs.length, results });
});

async function finaliseCompleted(
  supabase: ReturnType<typeof createClient>,
  apiToken: string,
  doc: { id: string; file_name: string; user_id: string | null; scan_type: string | null },
  data: Record<string, unknown>,
) {
  const reports = (data.reports ?? {}) as Record<string, { downloadUrl?: string }>;
  const similarityUrl = reports.similarity?.downloadUrl;
  const aiUrl = reports.ai?.downloadUrl;

  const safeBase = (doc.file_name || 'report').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '');
  const folder = doc.user_id ?? 'system';
  let similarityPath: string | null = null;
  let aiPath: string | null = null;

  if (similarityUrl) {
    similarityPath = `${folder}/${doc.id}_similarity_${safeBase}.pdf`;
    const ok = await downloadAndUpload(supabase, similarityUrl, similarityPath);
    if (!ok) similarityPath = null;
  }
  if (aiUrl && doc.scan_type !== 'similarity_only') {
    aiPath = `${folder}/${doc.id}_ai_${safeBase}.pdf`;
    const ok = await downloadAndUpload(supabase, aiUrl, aiPath);
    if (!ok) aiPath = null;
  }

  const update: Record<string, unknown> = {
    external_api_status: 'completed',
    external_api_last_polled_at: new Date().toISOString(),
    external_api_error: null,
    status: 'completed',
    automation_status: 'completed',
    completed_at: new Date().toISOString(),
  };
  // Similarity is returned as a percentage (e.g. 9.39 = 9%).
  // AI is returned on a 0-1 scale (e.g. 0.37 = 37%) — multiply by 100.
  if (typeof data.similarityScore === 'number') update.similarity_percentage = Math.round(data.similarityScore);
  if (typeof data.aiScore === 'number' && doc.scan_type !== 'similarity_only') update.ai_percentage = Math.round(data.aiScore * 100);
  if (similarityPath) update.similarity_report_path = similarityPath;
  if (aiPath) update.ai_report_path = aiPath;

  // If this is a full scan but the API did not deliver an AI report,
  // still auto-complete and add the preset "AI unavailable" remark so the
  // customer/staff sees the explanation.
  const aiMissing =
    doc.scan_type !== 'similarity_only' &&
    !aiPath &&
    (typeof data.aiScore !== 'number');

  if (aiMissing) {
    try {
      const { data: preset } = await supabase
        .from('remark_presets')
        .select('remark_text')
        .eq('is_active', true)
        .ilike('remark_text', 'AI writing detection is unavailable%')
        .order('sort_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (preset?.remark_text) {
        update.remarks = preset.remark_text;
      } else {
        update.remarks = 'AI writing detection is unavailable for this submission.';
      }
    } catch (_) {
      update.remarks = 'AI writing detection is unavailable for this submission.';
    }
    // Clear any stored AI score since report is unavailable
    update.ai_percentage = null;
  }

  await supabase.from('documents').update(update).eq('id', doc.id);
  return { similarityPath, aiPath, similarityScore: data.similarityScore, aiScore: data.aiScore, aiMissing };
}

async function downloadAndUpload(supabase: ReturnType<typeof createClient>, url: string, path: string): Promise<boolean> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return false;
    const buf = new Uint8Array(await resp.arrayBuffer());
    const { error } = await supabase.storage.from(REPORTS_BUCKET).upload(path, buf, {
      contentType: 'application/pdf',
      upsert: true,
    });
    return !error;
  } catch {
    return false;
  }
}

async function handleFailure(
  supabase: ReturnType<typeof createClient>,
  doc: { id: string; user_id: string | null; scan_type: string | null },
  remoteStatus: string,
  data: Record<string, unknown>,
) {
  const errMsg = (data?.error as string) ?? remoteStatus;
  const update: Record<string, unknown> = {
    external_api_status: remoteStatus,
    external_api_last_polled_at: new Date().toISOString(),
    external_api_error: errMsg,
    automation_status: 'failed',
    automation_error: errMsg,
  };

  // For system error → API auto-refunds 1 credit on their side; we also refund our internal credit for fairness if the document had been deducted.
  // For failed_invalid → no refund (matches API behaviour).
  if (remoteStatus === 'error' && doc.user_id) {
    // Re-add 1 credit via the existing system (best-effort)
    try {
      const creditType = doc.scan_type === 'similarity_only' ? 'similarity' : 'full';
      await supabase.rpc('consume_user_credit', {
        p_user_id: doc.user_id,
        p_credit_type: creditType,
        p_description: 'External API system error refund',
      });
    } catch (_) { /* swallow */ }
  }

  await supabase.from('documents').update(update).eq('id', doc.id);
}

async function logEvent(
  supabase: ReturnType<typeof createClient>,
  documentId: string | null,
  orderId: string | null,
  action: string,
  status: string,
  httpStatus: number | null,
  request: unknown,
  response: unknown,
  errorMessage: string | null,
) {
  try {
    await supabase.from('external_api_logs').insert({
      document_id: documentId,
      order_id: orderId,
      action,
      status,
      http_status: httpStatus,
      request_payload: request as object | null,
      response_payload: response as object | null,
      error_message: errorMessage,
    });
  } catch (_) { /* swallow */ }
}

async function handleResellerHook(
  supabase: ReturnType<typeof createClient>,
  doc: { id: string; reseller_scan_id?: string | null },
  status: 'completed' | 'failed',
  aiPath: string | null,
  aiPercentage: number | null,
  similarityPath: string | null,
  similarityPercentage: number | null,
  errorMsg: string | null,
) {
  if (!doc.reseller_scan_id) return;
  try {
    await supabase.from('reseller_scans').update({
      status,
      ai_percentage: aiPercentage,
      ai_report_path: aiPath,
      similarity_percentage: similarityPercentage,
      similarity_report_path: similarityPath,
      error: errorMsg,
      completed_at: new Date().toISOString(),
      webhook_next_retry_at: new Date().toISOString(),
    }).eq('id', doc.reseller_scan_id);

    // If failed, refund the credit
    if (status === 'failed') {
      const { data: scan } = await supabase.from('reseller_scans').select('reseller_id').eq('id', doc.reseller_scan_id).maybeSingle();
      if (scan?.reseller_id) {
        await supabase.rpc('refund_reseller_credit', {
          p_reseller_id: scan.reseller_id,
          p_scan_id: doc.reseller_scan_id,
          p_description: 'Scan failed - automatic refund',
        });
      }
    }

    // Fire webhook (best-effort)
    fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/reseller-webhook-dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ scanId: doc.reseller_scan_id }),
    }).catch(() => {});
  } catch (_) { /* swallow */ }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
