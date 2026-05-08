// Submits a single document to the external similarity/AI scan API.
// Marks the document with the returned orderId and external_api_status='submitted'.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const API_BASE = 'https://api.similaritycheck.app/api/v1';

type SupabaseClient = ReturnType<typeof createClient>;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const fallbackToken = Deno.env.get('SIMILARITYCHECK_API_TOKEN');

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const documentId = body?.documentId ?? null;
    const waitForCompletion = Boolean(body?.background);
    if (!documentId) return json({ error: 'documentId required' }, 400);

    const validation = await validateDocumentForSubmit(supabase, documentId);
    if (!validation.ok) return json({ error: validation.error, orderId: validation.orderId }, validation.status);

    await supabase
      .from('documents')
      .update({ external_api_status: 'queued', external_api_error: null })
      .eq('id', documentId);

    await supabase
      .from('documents')
      .update({ external_api_status: 'queued', external_api_error: null })
      .eq('id', documentId);

    // Resolve which account token to use
    const apiToken = await resolveApiToken(supabase, documentId, fallbackToken);
    if (!apiToken) return json({ error: 'no API account available for this document' }, 500);

    const job = submitDocumentToExternalApi(supabase, apiToken, documentId);
    if (waitForCompletion) {
      const result = await job;
      return json(result.body, result.status);
    }

    const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(job);
    else job.catch(() => undefined);

    return json({ ok: true, queued: true, documentId }, 202);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'unknown' }, 500);
  }
});

async function resolveApiToken(supabase: SupabaseClient, documentId: string, fallback: string | undefined): Promise<string | null> {
  const { data: doc } = await supabase
    .from('documents')
    .select('external_api_account_id')
    .eq('id', documentId)
    .maybeSingle();
  if (doc?.external_api_account_id) {
    const { data: acc } = await supabase
      .from('external_api_accounts')
      .select('api_token, enabled')
      .eq('id', doc.external_api_account_id)
      .maybeSingle();
    if (acc?.enabled && acc.api_token) return acc.api_token as string;
  }
  // Fallback: pick first enabled account; else env token.
  const { data: any } = await supabase
    .from('external_api_accounts')
    .select('id, api_token')
    .eq('enabled', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (any?.api_token) {
    await supabase.from('documents').update({ external_api_account_id: any.id }).eq('id', documentId);
    return any.api_token as string;
  }
  return fallback ?? null;
}

async function validateDocumentForSubmit(supabase: SupabaseClient, documentId: string) {
  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, status, external_api_order_id, deleted_by_user, cancelled_at')
    .eq('id', documentId)
    .maybeSingle();

  if (error || !doc) return { ok: false, status: 404, error: 'document not found' };
  if (doc.deleted_by_user || doc.cancelled_at) {
    return { ok: false, status: 400, error: 'document is cancelled or deleted' };
  }
  if (doc.external_api_order_id) {
    return { ok: false, status: 200, error: 'already submitted', orderId: doc.external_api_order_id };
  }
  if (!['pending', 'in_progress'].includes(doc.status)) {
    return { ok: false, status: 400, error: `document status is ${doc.status}, expected pending or in_progress` };
  }
  return { ok: true, status: 200 };
}

async function submitDocumentToExternalApi(supabase: SupabaseClient, apiToken: string, documentId: string): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .select('id, file_name, file_path, scan_type, exclude_quotes, exclude_bibliography, exclude_small_sources, exclude_citations, exclude_small_matches_words, status, external_api_order_id, external_api_status, external_api_attempt_count, deleted_by_user, cancelled_at, magic_link_id')
      .eq('id', documentId)
      .maybeSingle();

    if (docErr || !doc) return { status: 404, body: { error: 'document not found' } };
    if (doc.deleted_by_user || doc.cancelled_at) {
      return { status: 400, body: { error: 'document is cancelled or deleted' } };
    }
    if (doc.external_api_order_id) {
      return { status: 200, body: { ok: true, message: 'already submitted', orderId: doc.external_api_order_id } };
    }
    if (!['pending', 'in_progress'].includes(doc.status)) {
      return { status: 400, body: { error: `document status is ${doc.status}, expected pending or in_progress` } };
    }

    await supabase.from('documents').update({ external_api_status: 'downloading', external_api_error: null }).eq('id', doc.id);

    // Download file from storage — guests live in magic-uploads bucket
    const bucket = doc.magic_link_id ? 'magic-uploads' : 'documents';
    const { data: fileData, error: dlErr } = await supabase.storage
      .from(bucket)
      .download(doc.file_path);

    if (dlErr || !fileData) {
      await logEvent(supabase, doc.id, null, 'submit', 'error', null, { bucket, exclude_quotes: doc.exclude_quotes }, null, dlErr?.message ?? 'download failed');
      await supabase.from('documents').update({
        external_api_status: 'submit_failed',
        external_api_error: `Failed to download file: ${dlErr?.message ?? 'unknown'}`,
        external_api_attempt_count: (doc.external_api_attempt_count ?? 0) + 1,
      }).eq('id', doc.id);
      return { status: 500, body: { error: 'file download failed', details: dlErr?.message } };
    }

    await supabase.from('documents').update({ external_api_status: 'submitting', external_api_error: null }).eq('id', doc.id);

    const form = new FormData();
    form.append('file', new File([await fileData.arrayBuffer()], doc.file_name));
    if (doc.exclude_quotes) form.append('excludeQuotes', 'true');
    if (doc.exclude_bibliography) form.append('excludeBibliography', 'true');
    if (doc.exclude_citations) form.append('excludeCitations', 'true');
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
      signal: AbortSignal.timeout(90000),
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
      return { status: 502, body: { error: 'API submit failed', status: apiResp.status, details: apiJson } };
    }

    await supabase.from('documents').update({
      external_api_order_id: apiJson.orderId,
      external_api_status: 'submitted',
      external_api_submitted_at: new Date().toISOString(),
      external_api_error: null,
      external_api_attempt_count: (doc.external_api_attempt_count ?? 0) + 1,
      automation_status: 'processing',
      automation_started_at: new Date().toISOString(),
      status: 'in_progress',
    }).eq('id', doc.id);

    return { status: 200, body: { ok: true, orderId: apiJson.orderId } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    await logEvent(supabase, documentId, null, 'submit', 'error', null, null, null, msg);
    await supabase.from('documents').update({
      external_api_status: 'submit_failed',
      external_api_error: msg,
    }).eq('id', documentId);
    return { status: 500, body: { error: msg } };
  }
}

async function logEvent(
  supabase: SupabaseClient,
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
