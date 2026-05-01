// Cron worker — retries pending reseller webhooks (every minute).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: scans } = await supabase
    .from('reseller_scans')
    .select('id')
    .eq('webhook_delivered', false)
    .in('status', ['completed', 'failed'])
    .lte('webhook_next_retry_at', new Date().toISOString())
    .lt('webhook_attempts', 5)
    .limit(50);

  if (!scans || scans.length === 0) {
    return new Response(JSON.stringify({ ok: true, retried: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const results: Array<unknown> = [];
  for (const s of scans) {
    try {
      const r = await fetch(`${supabaseUrl}/functions/v1/reseller-webhook-dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ scanId: s.id }),
      });
      results.push({ id: s.id, ok: r.ok });
    } catch (e) {
      results.push({ id: s.id, ok: false, error: e instanceof Error ? e.message : 'unknown' });
    }
  }

  return new Response(JSON.stringify({ ok: true, retried: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
