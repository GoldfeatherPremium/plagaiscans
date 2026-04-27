// Returns the configured SendFox list ID (non-secret) for the admin UI.
// Never returns the access token or webhook secret.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { data: hasRole } = await adminClient.rpc('has_role', {
    _user_id: u.user.id,
    _role: 'admin',
  });
  if (!hasRole) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const listId = Deno.env.get('SENDFOX_LIST_ID') ?? '';
  const tokenConfigured = Boolean(Deno.env.get('SENDFOX_ACCESS_TOKEN'));
  const webhookConfigured = Boolean(Deno.env.get('SENDFOX_WEBHOOK_SECRET'));

  return new Response(
    JSON.stringify({
      list_id: listId,
      token_configured: tokenConfigured,
      webhook_configured: webhookConfigured,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
