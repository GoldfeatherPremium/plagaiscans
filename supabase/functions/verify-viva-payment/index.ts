import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyRequest {
  orderCode: string;
  transactionId?: string;
}

async function getVivaAccessToken(clientId: string, clientSecret: string, isDemo: boolean): Promise<string> {
  const baseUrl = isDemo 
    ? 'https://demo-accounts.vivapayments.com' 
    : 'https://accounts.vivapayments.com';
  
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const response = await fetch(`${baseUrl}/connect/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Failed to get Viva access token: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body: VerifyRequest = await req.json();
    const { orderCode, transactionId } = body;

    if (!orderCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order code is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Verifying Viva payment: orderCode=${orderCode}, transactionId=${transactionId}`);

    // Get payment record
    const { data: payment, error: paymentError } = await supabase
      .from('viva_payments')
      .select('*')
      .eq('order_code', orderCode)
      .single();

    if (paymentError || !payment) {
      console.error('Payment not found:', orderCode);
      return new Response(
        JSON.stringify({ success: false, error: 'Payment not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // If already completed, return the details
    if (payment.status === 'completed') {
      const { data: profile } = await supabase
        .from('profiles')
        .select('credit_balance, similarity_credit_balance')
        .eq('id', payment.user_id)
        .single();

      const creditType = payment.credit_type || 'full';
      const newBalance = creditType === 'similarity' 
        ? profile?.similarity_credit_balance 
        : profile?.credit_balance;

      return new Response(
        JSON.stringify({
          success: true,
          creditsAdded: payment.credits,
          newBalance: newBalance || 0,
          amountPaid: payment.amount_usd,
          status: 'completed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Viva settings
    const { data: settings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['viva_environment']);

    const environment = settings?.find(s => s.key === 'viva_environment')?.value || 'demo';
    const isDemo = environment === 'demo';

    const vivaClientId = Deno.env.get('VIVA_CLIENT_ID');
    const vivaClientSecret = Deno.env.get('VIVA_CLIENT_SECRET');

    if (!vivaClientId || !vivaClientSecret) {
      throw new Error('Viva.com credentials not configured');
    }

    // Get access token and check transaction status with Viva API
    const accessToken = await getVivaAccessToken(vivaClientId, vivaClientSecret, isDemo);
    
    const baseUrl = isDemo 
      ? 'https://demo-api.vivapayments.com' 
      : 'https://api.vivapayments.com';

    // Check order status
    const orderResponse = await fetch(`${baseUrl}/checkout/v2/orders/${orderCode}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!orderResponse.ok) {
      console.error('Failed to fetch order status:', orderResponse.status);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to verify payment', status: payment.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orderData = await orderResponse.json();
    console.log('Viva order status:', JSON.stringify(orderData));

    // Check if payment is completed
    // StateId: 0 = Pending, 1 = Expired, 2 = Canceled, 3 = Paid
    if (orderData.StateId === 3) {
      // Payment is complete - process it
      const idempotencyKey = `viva_verify_${orderCode}`;
      
      // Check idempotency
      const { data: existingKey } = await supabase
        .from('payment_idempotency_keys')
        .select('key')
        .eq('key', idempotencyKey)
        .single();

      if (!existingKey && payment.status !== 'completed') {
        // Insert idempotency key
        await supabase
          .from('payment_idempotency_keys')
          .insert({ key: idempotencyKey, provider: 'viva', user_id: payment.user_id });

        // Update payment status
        await supabase
          .from('viva_payments')
          .update({
            status: 'completed',
            transaction_id: transactionId || orderData.TransactionId || '',
            completed_at: new Date().toISOString(),
          })
          .eq('order_code', orderCode);

        // Get user's current credit balance
        const { data: profile } = await supabase
          .from('profiles')
          .select('credit_balance, similarity_credit_balance')
          .eq('id', payment.user_id)
          .single();

        if (profile) {
          const creditType = payment.credit_type || 'full';
          const currentBalance = creditType === 'similarity' 
            ? profile.similarity_credit_balance 
            : profile.credit_balance;
          const newBalance = currentBalance + payment.credits;

          const updateField = creditType === 'similarity' 
            ? { similarity_credit_balance: newBalance }
            : { credit_balance: newBalance };

          await supabase
            .from('profiles')
            .update(updateField)
            .eq('id', payment.user_id);

          // Record credit transaction
          await supabase
            .from('credit_transactions')
            .insert({
              user_id: payment.user_id,
              amount: payment.credits,
              transaction_type: 'purchase',
              credit_type: creditType,
              balance_before: currentBalance,
              balance_after: newBalance,
              description: `Viva.com payment verification - Order ${orderCode}`,
            });

          console.log(`Added ${payment.credits} credits via verification. New balance: ${newBalance}`);

          return new Response(
            JSON.stringify({
              success: true,
              creditsAdded: payment.credits,
              newBalance: newBalance,
              amountPaid: payment.amount_usd,
              status: 'completed',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Already processed
      const { data: profile } = await supabase
        .from('profiles')
        .select('credit_balance, similarity_credit_balance')
        .eq('id', payment.user_id)
        .single();

      const creditType = payment.credit_type || 'full';
      const balance = creditType === 'similarity' 
        ? profile?.similarity_credit_balance 
        : profile?.credit_balance;

      return new Response(
        JSON.stringify({
          success: true,
          creditsAdded: payment.credits,
          newBalance: balance || 0,
          amountPaid: payment.amount_usd,
          status: 'completed',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Payment not yet completed
    const statusMessages: Record<number, string> = {
      0: 'pending',
      1: 'expired',
      2: 'canceled',
    };

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Payment not completed',
        status: statusMessages[orderData.StateId] || 'unknown',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Viva verification error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
