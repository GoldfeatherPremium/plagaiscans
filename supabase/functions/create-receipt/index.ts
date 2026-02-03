import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-RECEIPT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Starting receipt creation');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      userId,
      invoiceId,
      customerName,
      customerEmail,
      customerCountry,
      description,
      quantity,
      unitPrice,
      subtotal,
      vatRate,
      vatAmount,
      amountPaid,
      currency,
      paymentMethod,
      transactionId,
      paymentId,
      credits,
      receiptDate,
      stripe_receipt_url,
      stripe_charge_id,
    } = await req.json();

    logStep('Receipt data received', { userId, amountPaid, credits, paymentMethod });

    if (!userId || !amountPaid || !credits || !paymentMethod) {
      throw new Error('Missing required fields: userId, amountPaid, credits, paymentMethod');
    }

    // Create the receipt
    const receiptData: any = {
      user_id: userId,
      invoice_id: invoiceId || null,
      customer_name: customerName || 'Customer',
      customer_email: customerEmail,
      customer_country: customerCountry,
      description: description || 'Plagiarism & AI Content Analysis Service',
      quantity: quantity || credits,
      unit_price: unitPrice || (amountPaid / credits),
      subtotal: subtotal || amountPaid,
      vat_rate: vatRate || 0,
      vat_amount: vatAmount || 0,
      amount_paid: amountPaid,
      currency: currency || 'USD',
      payment_method: paymentMethod,
      transaction_id: transactionId,
      payment_id: paymentId,
      credits: credits,
      receipt_date: receiptDate || new Date().toISOString(),
      stripe_receipt_url: stripe_receipt_url || null,
      stripe_charge_id: stripe_charge_id || null,
    };

    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .insert(receiptData)
      .select()
      .single();

    if (receiptError) {
      logStep('Receipt creation error', { error: receiptError });
      throw new Error(`Failed to create receipt: ${receiptError.message}`);
    }

    logStep('Receipt created successfully', { 
      receipt_id: receipt.id, 
      receipt_number: receipt.receipt_number 
    });

    return new Response(
      JSON.stringify({
        success: true,
        receipt: {
          id: receipt.id,
          receipt_number: receipt.receipt_number,
          amount_paid: receipt.amount_paid,
          currency: receipt.currency,
          receipt_date: receipt.receipt_date,
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('Error creating receipt', { error: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
