// Submits a single document to the external similarity/AI scan API.
// Marks the document with the returned orderId and external_api_status='submitted'.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const API_BASE = 'https://api.similaritycheck.app/api/v1';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const apiToken = Deno.env.get('SIMILARITYCHECK_API_TOKEN');

  if (!apiToken) {
    return json({ error: 'SIMILARITYCHECK_API_TOKEN not configured' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  let documentId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    documentId = body?.documentId ?? null;
    if (!documentId) return json({ error: 'documentId required' }, 400);

    // Load document
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('id, file_name, file_path, scan_type, exclude_quotes, exclude_bibliography, exclude_small_sources, exclude_citations, exclude_small_matches_words, status, external_api_order_id, external_api_status, external_api_attempt_count, deleted_by_user, cancelled_at, magic_link_id')
      .eq('id', documentId)
      .maybeSingle();

    if (docErr || !doc) return json({ error: 'document not found' }, 404);
    if (doc.deleted_by_user || doc.cancelled_at) {
      return json({ error: 'document is cancelled or deleted' }, 400);
    }
    if (doc.external_api_order_id) {
      return json({ ok: true, message: 'already submitted', orderId: doc.external_api_order_id });
    }
    if (!['pending', 'in_progress'].includes(doc.status)) {
      return json({ error: `document status is ${doc.status}, expected pending or in_progress` }, 400);
    }

    // Download file from storage — guests live in magic-uploads bucket
    const bucket = doc.magic_link_id ? 'magic-uploads' : 'documents';
    const { data: fileData, error: dlErr } = await supabase.storage
      .from(bucket)
      .download(doc.file_path);

    if (dlErr || !fileData) {
      await logEvent(supabase, doc.id, null, 'submit', 'error', null, { exclude_quotes: doc.exclude_quotes }, null, dlErr?.message ?? 'download failed');
      await supabase.from('documents').update({
        external_api_status: 'submit_failed',
        external_api_error: `Failed to download file: ${dlErr?.message ?? 'unknown'}`,
        external_api_attempt_count: (doc.external_api_attempt_count ?? 0) + 1,
      }).eq('id', doc.id);
      return json({ error: 'file download failed', details: dlErr?.message }, 500);
    }

    // Build multipart form
    const form = new FormData();
    form.append('file', new File([await fileData.arrayBuffer()], doc.file_name));
    if (doc.exclude_quotes) form.append('excludeQuotes', 'true');
    if (doc.exclude_bibliography) form.append('excludeBibliography', 'true');
    if (doc.exclude_citations) form.append('excludeCitations', 'true');
    // Numeric small-matches threshold (preferred); fall back to legacy boolean default of 8
    const smallWords = Number(doc.exclude_small_matches_words ?? 0);
    if (smallWords > 0) {
      form.append('minWords', String(smallWords));
    } else if (doc.exclude_small_sources) {
      form.append('minWords', '8');
    }
    form.append('title', doc.file_name);

    const apiResp = await fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}` },
      body: form,
    });

    const apiJson = await apiResp.json().catch(() => ({}));
    await logEvent(
      supabase,
      doc.id,
      apiJson?.orderId ?? null,
      'submit',
      apiResp.ok ? 'success' : 'error',
      apiResp.status,
      { file_name: doc.file_name, exclude_quotes: doc.exclude_quotes, exclude_bibliography: doc.exclude_bibliography, exclude_citations: doc.exclude_citations, exclude_small_matches_words: doc.exclude_small_matches_words, exclude_small_sources: doc.exclude_small_sources, minWords: smallWords > 0 ? smallWords : (doc.exclude_small_sources ? 8 : 0) },
      apiJson,
      apiResp.ok ? null : (apiJson?.error || apiJson?.code || `HTTP ${apiResp.status}`),
    );

    if (!apiResp.ok || !apiJson?.orderId) {
      await supabase.from('documents').update({
        external_api_status: apiResp.status === 429 ? 'rate_limited' : 'submit_failed',
        external_api_error: `${apiJson?.code ?? `HTTP ${apiResp.status}`}: ${apiJson?.error ?? 'submit failed'}`,
        external_api_attempt_count: (doc.external_api_attempt_count ?? 0) + 1,
      }).eq('id', doc.id);
      return json({ error: 'API submit failed', status: apiResp.status, details: apiJson }, 502);
    }

    await supabase.from('documents').update({
      external_api_order_id: apiJson.orderId,
      external_api_status: 'submitted',
      external_api_submitted_at: new Date().toISOString(),
      external_api_error: null,
      external_api_attempt_count: (doc.external_api_attempt_count ?? 0) + 1,
      automation_status: 'processing',
      automation_started_at: new Date().toISOString(),
      // Move out of the pending bucket — the API has picked it up
      status: 'in_progress',
    }).eq('id', doc.id);

    return json({ ok: true, orderId: apiJson.orderId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    if (documentId) {
      await logEvent(supabase, documentId, null, 'submit', 'error', null, null, null, msg);
    }
    return json({ error: msg }, 500);
  }
});

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
