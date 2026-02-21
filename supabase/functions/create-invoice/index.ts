import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-INVOICE] ${step}${detailsStr}`);
};

interface CreateInvoiceRequest {
  payment_type: string;
  payment_id?: string;
  transaction_id?: string;
  user_id: string;
  amount_usd: number;
  credits: number;
  description?: string;
  customer_name?: string;
  customer_email?: string;
  customer_country?: string;
  customer_address?: string;
  notes?: string;
  status?: string;
  currency?: string;
  vat_rate?: number;
  vat_amount?: number;
  unit_price?: number;
  quantity?: number;
  invoice_date?: string; // Custom invoice date for backdating
  payment_date?: string; // Custom payment date
  stripe_invoice_id?: string; // Stripe invoice ID (e.g., in_xxx)
  stripe_invoice_url?: string; // URL to Stripe's hosted invoice page
  stripe_receipt_url?: string; // URL to Stripe's receipt page
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    // Allow both authenticated users and service role calls
    const authHeader = req.headers.get("Authorization");
    let isServiceRole = false;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      
      // Check if it's the service role key
      if (token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
        isServiceRole = true;
        logStep("Service role authentication");
      } else {
        // Validate user token
        const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
        if (userError) throw new Error(`Authentication error: ${userError.message}`);
        const user = userData.user;
        if (!user) throw new Error("User not authenticated");
        
        // Check if user is admin
        const { data: userRole } = await supabaseClient.rpc('get_user_role', { _user_id: user.id });
        if (userRole !== 'admin') {
          throw new Error("Only admins can manually create invoices");
        }
        logStep("Admin authenticated", { userId: user.id });
      }
    } else {
      throw new Error("No authorization header provided");
    }

    const requestData: CreateInvoiceRequest = await req.json();
    
    const { 
      payment_type, 
      payment_id, 
      transaction_id,
      user_id, 
      amount_usd, 
      credits, 
      description,
      customer_name,
      customer_email,
      customer_country,
      customer_address,
      notes,
      status = 'paid',
      currency = 'USD',
      vat_rate = 0,
      vat_amount = 0,
      subtotal: requestSubtotal,
      unit_price,
      quantity = 1,
      invoice_date,
      payment_date,
      stripe_invoice_id,
      stripe_invoice_url,
      stripe_receipt_url
    } = requestData as any;

    // Validate required fields
    if (!user_id || !amount_usd || !credits || !payment_type) {
      throw new Error("Missing required fields: user_id, amount_usd, credits, payment_type");
    }

    logStep("Creating invoice", { payment_type, amount_usd, credits, currency });

    // Check if invoice already exists for this payment
    if (payment_id) {
      const { data: existingInvoice } = await supabaseClient
        .from('invoices')
        .select('id, invoice_number')
        .eq('payment_id', payment_id)
        .eq('payment_type', payment_type)
        .single();

      if (existingInvoice) {
        logStep("Invoice already exists", { invoiceId: existingInvoice.id });
        return new Response(JSON.stringify({ 
          success: true, 
          invoice: existingInvoice,
          message: "Invoice already exists"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // Get customer details if not provided
    let finalCustomerName = customer_name;
    let finalCustomerEmail = customer_email;
    
    if (!finalCustomerName || !finalCustomerEmail) {
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('full_name, email')
        .eq('id', user_id)
        .single();
      
      if (profile) {
        finalCustomerName = finalCustomerName || profile.full_name || 'Guest Customer';
        finalCustomerEmail = finalCustomerEmail || profile.email;
      }
    }

    // Calculate subtotal and unit price
    // If subtotal is provided (e.g. from Paddle where tax is included in total), use it
    // Otherwise, subtotal equals the total amount (no tax added on top)
    const subtotal = requestSubtotal || (vat_amount > 0 ? amount_usd - vat_amount : amount_usd);
    const finalUnitPrice = unit_price || subtotal;

    // Determine dates
    const now = new Date().toISOString();
    const finalInvoiceDate = invoice_date ? new Date(invoice_date).toISOString() : now;
    const finalPaymentDate = status === 'paid' 
      ? (payment_date ? new Date(payment_date).toISOString() : finalInvoiceDate)
      : null;

    // Auto-generate transaction_id if not provided
    let finalTransactionId = transaction_id;
    if (!finalTransactionId) {
      const { data: generatedId } = await supabaseClient.rpc('generate_transaction_id');
      finalTransactionId = generatedId || `TXN-${Date.now()}`;
      logStep("Generated transaction_id", { transaction_id: finalTransactionId });
    }

    // Create the invoice
    const { data: invoice, error: insertError } = await supabaseClient
      .from('invoices')
      .insert({
        user_id,
        amount_usd,
        credits,
        payment_type,
        payment_id: payment_id || null,
        transaction_id: finalTransactionId,
        description: description || 'Plagiarism & AI Content Analysis Service',
        customer_name: finalCustomerName,
        customer_email: finalCustomerEmail,
        customer_country: customer_country || null,
        customer_address: customer_address || null,
        notes: notes || null,
        status,
        currency,
        subtotal,
        unit_price: finalUnitPrice,
        quantity,
        vat_rate,
        vat_amount,
        created_at: finalInvoiceDate,
        paid_at: finalPaymentDate,
        is_immutable: status === 'paid',
        invoice_number: '', // Will be auto-generated by trigger
        stripe_invoice_id: stripe_invoice_id || null,
        stripe_invoice_url: stripe_invoice_url || null,
        stripe_receipt_url: stripe_receipt_url || null,
      })
      .select()
      .single();

    if (insertError) throw new Error(`Failed to create invoice: ${insertError.message}`);
    
    logStep("Invoice created successfully", { invoiceId: invoice.id, invoiceNumber: invoice.invoice_number });

    return new Response(JSON.stringify({ 
      success: true, 
      invoice 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
