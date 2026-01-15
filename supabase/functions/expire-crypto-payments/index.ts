import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting crypto payment expiration check...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all waiting payments older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: expiredPayments, error: fetchError } = await supabase
      .from('crypto_payments')
      .select('id, created_at, user_id, amount_usd')
      .eq('status', 'waiting')
      .lt('created_at', oneHourAgo)
      .limit(1000);

    if (fetchError) {
      console.error('Error fetching expired payments:', fetchError);
      throw fetchError;
    }

    if (!expiredPayments || expiredPayments.length === 0) {
      console.log('No expired crypto payments found');
      return new Response(
        JSON.stringify({ message: 'No expired payments', expiredCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${expiredPayments.length} expired crypto payments`);

    // Update all expired payments to failed status
    const { error: updateError } = await supabase
      .from('crypto_payments')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('status', 'waiting')
      .lt('created_at', oneHourAgo);

    if (updateError) {
      console.error('Error updating expired payments:', updateError);
      throw updateError;
    }

    console.log(`Successfully expired ${expiredPayments.length} crypto payments`);

    return new Response(
      JSON.stringify({ 
        message: 'Expired payments updated', 
        expiredCount: expiredPayments.length,
        expiredPaymentIds: expiredPayments.map(p => p.id)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in expire-crypto-payments function:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
