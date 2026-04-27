// Sync a single user to SendFox as a contact, with computed segmentation tags.
// Idempotent: safe to call repeatedly. Skips suppressed emails.
// Isolated from the SendPulse transactional pipeline.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const SENDFOX_TOKEN = Deno.env.get('SENDFOX_ACCESS_TOKEN') ?? '';
const SENDFOX_LIST_ID = Deno.env.get('SENDFOX_LIST_ID') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function sendfoxFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.sendfox.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${SENDFOX_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  if (!res.ok) {
    throw new Error(`SendFox ${path} ${res.status}: ${text}`);
  }
  return parsed ?? {};
}

interface AggregatedStats {
  lifetime_spend: number;
  total_purchases: number;
  last_login_at: string | null;
}

async function loadAggregates(userId: string, profileEmail: string): Promise<AggregatedStats> {
  // Paid invoices → lifetime spend / purchase count.
  const { data: invoices } = await supabase
    .from('invoices')
    .select('amount_usd, status')
    .eq('user_id', userId)
    .eq('status', 'paid');

  const lifetime_spend = (invoices ?? []).reduce(
    (sum, inv: any) => sum + (Number(inv.amount_usd) || 0),
    0,
  );
  const total_purchases = (invoices ?? []).length;

  // Last sign-in via auth admin
  let last_login_at: string | null = null;
  try {
    const { data: u } = await supabase.auth.admin.getUserById(userId);
    last_login_at = u?.user?.last_sign_in_at ?? null;
  } catch {
    last_login_at = null;
  }

  return { lifetime_spend, total_purchases, last_login_at };
}

function computeTags(profile: any, stats: AggregatedStats): string[] {
  const tags: string[] = [];
  const credits =
    (profile.credit_balance ?? 0) + (profile.similarity_credit_balance ?? 0);

  tags.push(stats.total_purchases > 0 ? 'customer' : 'lead');
  if (credits < 5) tags.push('low_credits');
  if (stats.lifetime_spend >= 100) tags.push('high_value');

  const now = Date.now();
  if (stats.last_login_at) {
    const days = (now - new Date(stats.last_login_at).getTime()) / 86_400_000;
    if (days <= 7) tags.push('active');
    if (days >= 30) tags.push('inactive_30d');
  } else {
    tags.push('inactive_30d');
  }
  return tags;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  let user_id: string | null = null;
  try {
    if (!SENDFOX_TOKEN || !SENDFOX_LIST_ID) {
      throw new Error('SendFox not configured: missing SENDFOX_ACCESS_TOKEN or SENDFOX_LIST_ID');
    }

    const body = await req.json().catch(() => ({}));
    user_id = body.user_id ?? null;
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Load profile
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('id, email, full_name, credit_balance, similarity_credit_balance')
      .eq('id', user_id)
      .maybeSingle();

    if (profErr) throw profErr;
    if (!profile) throw new Error('Profile not found');
    if (!profile.email) throw new Error('User has no email');

    const lowerEmail = profile.email.toLowerCase();

    // 2. Suppression short-circuit
    const { data: suppressed } = await supabase
      .from('email_suppressions')
      .select('email')
      .eq('email', lowerEmail)
      .maybeSingle();

    if (suppressed) {
      await supabase.from('sendfox_sync_log').insert({
        user_id,
        email: profile.email,
        action: 'skip_suppressed',
        status: 'success',
      });
      return new Response(JSON.stringify({ skipped: 'suppressed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Aggregates + tags
    const stats = await loadAggregates(user_id, profile.email);
    const tags = computeTags(profile, stats);

    const fullName = (profile.full_name ?? '').trim();
    const [firstName, ...rest] = fullName.split(/\s+/);
    const lastName = rest.join(' ');

    // 4. Lookup existing mapping
    const { data: existing } = await supabase
      .from('sendfox_contacts')
      .select('sendfox_contact_id')
      .eq('user_id', user_id)
      .maybeSingle();

    const listIdNum = Number(SENDFOX_LIST_ID);
    let sendfoxId: string;

    if (existing?.sendfox_contact_id) {
      const updated = await sendfoxFetch(`/contacts/${existing.sendfox_contact_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          lists: [listIdNum],
        }),
      });
      sendfoxId = String(updated?.id ?? existing.sendfox_contact_id);
    } else {
      const created = await sendfoxFetch('/contacts', {
        method: 'POST',
        body: JSON.stringify({
          email: profile.email,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          lists: [listIdNum],
        }),
      });
      sendfoxId = String(created?.id ?? '');
      if (!sendfoxId) throw new Error('SendFox returned no contact id');
    }

    // 5. Upsert local mapping
    await supabase.from('sendfox_contacts').upsert(
      {
        user_id,
        sendfox_contact_id: sendfoxId,
        email: profile.email,
        current_tags: tags,
        last_synced_at: new Date().toISOString(),
        sync_status: 'ok',
      },
      { onConflict: 'user_id' },
    );

    await supabase.from('sendfox_sync_log').insert({
      user_id,
      email: profile.email,
      action: 'sync',
      status: 'success',
    });

    return new Response(
      JSON.stringify({ ok: true, sendfox_id: sendfoxId, tags }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('sync-contact-to-sendfox error', msg);
    try {
      await supabase.from('sendfox_sync_log').insert({
        user_id,
        action: 'sync',
        status: 'failed',
        error: msg,
      });
    } catch (_) { /* swallow */ }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
