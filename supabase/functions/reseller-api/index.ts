// Reseller-facing public API. Authenticates via X-API-Key header.
// Endpoints:
//   POST   /scans                  -> submit AI scan (multipart: file + options)
//   GET    /scans                  -> list scans (paginated)
//   GET    /scans/:id              -> get scan details + report URL when completed
//   GET    /scans/:id/report       -> 302 redirect to signed report URL
//   GET    /account                -> account/credit info
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'odt', 'rtf', 'txt', 'html'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Naive in-memory rate limiting (per warm instance)
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Strip function prefix from URL
  const url = new URL(req.url);
  let path = url.pathname.replace(/^\/+functions\/v1\/reseller-api/, '').replace(/^\/+reseller-api/, '');
  if (!path.startsWith('/')) path = '/' + path;
  if (path === '/' || path === '') path = '/';

  // Authenticate
  const apiKey = req.headers.get('x-api-key') || req.headers.get('X-API-Key');
  if (!apiKey) return json({ error: 'Missing X-API-Key header' }, 401);

  const keyHash = await sha256Hex(apiKey);
  const { data: keyRow } = await supabase
    .from('reseller_api_keys')
    .select('id, reseller_id, revoked_at, expires_at')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (!keyRow || keyRow.revoked_at || (keyRow.expires_at && new Date(keyRow.expires_at) < new Date())) {
    return json({ error: 'Invalid or revoked API key' }, 401);
  }

  const { data: reseller } = await supabase
    .from('resellers')
    .select('id, name, status, credit_balance, total_credits_purchased, total_credits_used, webhook_url, rate_limit_per_min')
    .eq('id', keyRow.reseller_id)
    .maybeSingle();

  if (!reseller) return json({ error: 'Reseller not found' }, 401);
  if (reseller.status !== 'active') return json({ error: 'Reseller account is suspended' }, 403);

  // Rate limit
  const now = Date.now();
  const limit = reseller.rate_limit_per_min || 60;
  const bucket = rateBuckets.get(keyRow.id);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(keyRow.id, { count: 1, resetAt: now + 60_000 });
  } else {
    bucket.count++;
    if (bucket.count > limit) {
      await logRequest(supabase, reseller.id, keyRow.id, req.method, path, 429, req, startedAt, 'Rate limit exceeded');
      return json({ error: 'Rate limit exceeded', limit, window: '1m' }, 429);
    }
  }

  // Update last_used_at (fire-and-forget)
  supabase.from('reseller_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRow.id).then(() => {});

  let response: Response;
  try {
    if (req.method === 'POST' && path === '/scans') {
      response = await submitScan(supabase, reseller, keyRow.id, req);
    } else if (req.method === 'GET' && path === '/scans') {
      response = await listScans(supabase, reseller.id, url);
    } else if (req.method === 'GET' && /^\/scans\/[^/]+$/.test(path)) {
      const id = path.split('/').pop()!;
      response = await getScan(supabase, reseller.id, id);
    } else if (req.method === 'GET' && /^\/scans\/[^/]+\/report$/.test(path)) {
      const id = path.split('/')[2];
      response = await downloadReport(supabase, reseller.id, id);
    } else if (req.method === 'GET' && path === '/account') {
      response = json({
        reseller: {
          id: reseller.id,
          name: reseller.name,
          status: reseller.status,
          credit_balance: reseller.credit_balance,
          total_credits_purchased: reseller.total_credits_purchased,
          total_credits_used: reseller.total_credits_used,
          webhook_url: reseller.webhook_url,
          rate_limit_per_min: reseller.rate_limit_per_min,
        },
      });
    } else {
      response = json({ error: 'Not found', path, method: req.method }, 404);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown';
    response = json({ error: 'Internal error', details: msg }, 500);
  }

  await logRequest(supabase, reseller.id, keyRow.id, req.method, path, response.status, req, startedAt, null);
  return response;
});

async function submitScan(supabase: ReturnType<typeof createClient>, reseller: any, apiKeyId: string, req: Request): Promise<Response> {
  if (reseller.credit_balance < 1) {
    return json({ error: 'Insufficient credits', credit_balance: reseller.credit_balance }, 402);
  }

  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('multipart/form-data')) {
    return json({ error: 'Content-Type must be multipart/form-data' }, 400);
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'Missing file field' }, 400);
  if (file.size === 0) return json({ error: 'File is empty' }, 400);
  if (file.size > MAX_FILE_SIZE) return json({ error: 'File too large (max 50MB)' }, 400);

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return json({ error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` }, 400);
  }
  if (ext === 'doc') return json({ error: '.doc files are not supported. Use .docx instead.' }, 400);

  const externalReference = (form.get('external_reference') as string) || null;
  const excludeBibliography = form.get('exclude_bibliography') === 'true';
  const excludeQuotes = form.get('exclude_quotes') === 'true';
  const excludeCitations = form.get('exclude_citations') === 'true';
  const excludeSmallMatchesWords = Number(form.get('exclude_small_matches_words') ?? 0);

  // Sanitize path component but keep file_name original
  const safePath = `reseller-${reseller.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  const { error: upErr } = await supabase.storage
    .from('documents')
    .upload(safePath, new Uint8Array(await file.arrayBuffer()), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (upErr) return json({ error: 'File upload failed', details: upErr.message }, 500);

  // Create reseller_scan first (so we can link document to it)
  const { data: scan, error: scanErr } = await supabase
    .from('reseller_scans')
    .insert({
      reseller_id: reseller.id,
      api_key_id: apiKeyId,
      external_reference: externalReference,
      file_name: file.name,
      status: 'queued',
      ip_address: req.headers.get('x-forwarded-for') ?? null,
    })
    .select()
    .single();

  if (scanErr || !scan) {
    await supabase.storage.from('documents').remove([safePath]);
    return json({ error: 'Failed to create scan record', details: scanErr?.message }, 500);
  }

  // Create document
  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .insert({
      file_name: file.name,
      file_path: safePath,
      scan_type: 'ai_only_reseller',
      status: 'pending',
      reseller_scan_id: scan.id,
      exclude_bibliography: excludeBibliography,
      exclude_quotes: excludeQuotes,
      exclude_citations: excludeCitations,
      exclude_small_matches_words: excludeSmallMatchesWords,
      exclude_small_sources: false,
    })
    .select()
    .single();

  if (docErr || !doc) {
    await supabase.from('reseller_scans').update({ status: 'failed', error: docErr?.message ?? 'doc create failed' }).eq('id', scan.id);
    await supabase.storage.from('documents').remove([safePath]);
    return json({ error: 'Failed to create document', details: docErr?.message }, 500);
  }

  await supabase.from('reseller_scans').update({ document_id: doc.id }).eq('id', scan.id);

  // Deduct 1 credit
  const { data: deduct } = await supabase.rpc('consume_reseller_credit', {
    p_reseller_id: reseller.id,
    p_scan_id: scan.id,
    p_description: `AI scan: ${file.name}`,
  });

  if (!deduct || (deduct as any).success === false) {
    // Rollback
    await supabase.from('documents').delete().eq('id', doc.id);
    await supabase.from('reseller_scans').update({ status: 'failed', error: 'Credit deduction failed' }).eq('id', scan.id);
    await supabase.storage.from('documents').remove([safePath]);
    return json({ error: 'Credit deduction failed', details: (deduct as any)?.error }, 402);
  }

  // Trigger external API submit (fire and forget)
  fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/external-api-submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify({ documentId: doc.id }),
  }).catch(() => {});

  return json({
    scan_id: scan.id,
    external_reference: externalReference,
    status: 'queued',
    file_name: file.name,
    credit_balance: reseller.credit_balance - 1,
    created_at: scan.created_at,
  }, 201);
}

async function listScans(supabase: ReturnType<typeof createClient>, resellerId: string, url: URL): Promise<Response> {
  const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 50));
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const status = url.searchParams.get('status');

  let q = supabase
    .from('reseller_scans')
    .select('id, external_reference, file_name, status, ai_percentage, created_at, completed_at, error', { count: 'exact' })
    .eq('reseller_id', resellerId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) q = q.eq('status', status);

  const { data, count, error } = await q;
  if (error) return json({ error: error.message }, 500);

  return json({ scans: data ?? [], total: count ?? 0, limit, offset });
}

async function getScan(supabase: ReturnType<typeof createClient>, resellerId: string, id: string): Promise<Response> {
  const { data: scan } = await supabase
    .from('reseller_scans')
    .select('id, external_reference, file_name, status, ai_percentage, ai_report_path, similarity_percentage, similarity_report_path, error, created_at, completed_at')
    .eq('reseller_id', resellerId)
    .eq('id', id)
    .maybeSingle();

  if (!scan) return json({ error: 'Scan not found' }, 404);

  let ai_report_url: string | null = null;
  let similarity_report_url: string | null = null;
  if (scan.status === 'completed' && scan.ai_report_path) {
    const { data: signed } = await supabase.storage.from('reports').createSignedUrl(scan.ai_report_path, 3600);
    ai_report_url = signed?.signedUrl ?? null;
  }
  if (scan.status === 'completed' && scan.similarity_report_path) {
    const { data: signed } = await supabase.storage.from('reports').createSignedUrl(scan.similarity_report_path, 3600);
    similarity_report_url = signed?.signedUrl ?? null;
  }

  return json({
    scan_id: scan.id,
    external_reference: scan.external_reference,
    file_name: scan.file_name,
    status: scan.status,
    ai_percentage: scan.ai_percentage,
    similarity_percentage: scan.similarity_percentage,
    error: scan.error,
    report_url: ai_report_url,
    ai_report_url,
    similarity_report_url,
    created_at: scan.created_at,
    completed_at: scan.completed_at,
  });
}

async function downloadReport(supabase: ReturnType<typeof createClient>, resellerId: string, id: string): Promise<Response> {
  const { data: scan } = await supabase
    .from('reseller_scans')
    .select('ai_report_path, status')
    .eq('reseller_id', resellerId)
    .eq('id', id)
    .maybeSingle();

  if (!scan || !scan.ai_report_path) return json({ error: 'Report not available' }, 404);

  const { data: signed } = await supabase.storage.from('reports').createSignedUrl(scan.ai_report_path, 3600);
  if (!signed) return json({ error: 'Failed to create signed URL' }, 500);
  return new Response(null, { status: 302, headers: { ...corsHeaders, Location: signed.signedUrl } });
}

async function logRequest(
  supabase: ReturnType<typeof createClient>,
  resellerId: string,
  apiKeyId: string,
  method: string,
  path: string,
  statusCode: number,
  req: Request,
  startedAt: number,
  error: string | null,
) {
  try {
    await supabase.from('reseller_api_logs').insert({
      reseller_id: resellerId,
      api_key_id: apiKeyId,
      method,
      path,
      status_code: statusCode,
      ip_address: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent'),
      response_time_ms: Date.now() - startedAt,
      error,
    });
  } catch (_) { /* swallow */ }
}
