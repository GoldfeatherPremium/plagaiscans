import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-INVOICE-PDF] ${step}${detailsStr}`);
};

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const { invoiceId } = await req.json();
    if (!invoiceId) throw new Error("Invoice ID is required");
    logStep("Invoice ID received", { invoiceId });

    // Fetch invoice details
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError) throw new Error(`Failed to fetch invoice: ${invoiceError.message}`);
    if (!invoice) throw new Error("Invoice not found");

    // Check if user has access to this invoice
    const { data: userRole } = await supabaseClient.rpc('get_user_role', { _user_id: user.id });
    if (invoice.user_id !== user.id && userRole !== 'admin') {
      throw new Error("Unauthorized to access this invoice");
    }
    logStep("Invoice fetched", { invoiceNumber: invoice.invoice_number });

    // Get site content for company details
    const { data: siteContent } = await supabaseClient
      .from('site_content')
      .select('content_key, content_value')
      .in('content_key', ['company_name', 'company_address', 'company_email', 'company_phone']);
    
    const companyDetails: Record<string, string> = {};
    siteContent?.forEach(item => {
      companyDetails[item.content_key] = item.content_value;
    });

    const companyName = companyDetails.company_name || 'Plagaiscan';
    const companyAddress = companyDetails.company_address || '';
    const companyEmail = companyDetails.company_email || '';
    const companyPhone = companyDetails.company_phone || '';

    // Generate PDF content as HTML (will be converted to PDF by frontend)
    const invoiceDate = new Date(invoice.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const paidDate = invoice.paid_at 
      ? new Date(invoice.paid_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : invoiceDate;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; line-height: 1.6; }
    .invoice-container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #3b82f6; padding-bottom: 30px; }
    .company-info h1 { font-size: 28px; color: #3b82f6; margin-bottom: 5px; }
    .company-info p { color: #666; font-size: 13px; }
    .invoice-title { text-align: right; }
    .invoice-title h2 { font-size: 32px; color: #1a1a1a; margin-bottom: 10px; }
    .invoice-title .invoice-number { font-size: 18px; color: #3b82f6; font-weight: 600; }
    .invoice-title .status { display: inline-block; padding: 6px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-top: 10px; }
    .status-paid { background: #dcfce7; color: #166534; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .details-row { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .detail-box { width: 48%; }
    .detail-box h3 { font-size: 12px; text-transform: uppercase; color: #888; letter-spacing: 1px; margin-bottom: 10px; }
    .detail-box p { color: #333; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    .items-table th { background: #f8fafc; padding: 14px 16px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; border-bottom: 2px solid #e2e8f0; }
    .items-table td { padding: 16px; border-bottom: 1px solid #e2e8f0; }
    .items-table .amount { text-align: right; font-weight: 600; }
    .totals { margin-left: auto; width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
    .totals-row.total { border-bottom: none; border-top: 2px solid #1a1a1a; font-size: 20px; font-weight: 700; padding-top: 16px; }
    .footer { margin-top: 60px; padding-top: 30px; border-top: 1px solid #e2e8f0; text-align: center; color: #888; font-size: 13px; }
    .footer p { margin-bottom: 5px; }
    .payment-info { background: #f0f9ff; border-radius: 8px; padding: 20px; margin-top: 30px; }
    .payment-info h4 { color: #0369a1; margin-bottom: 10px; }
    .payment-info p { color: #0c4a6e; font-size: 14px; }
    @media print { 
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .invoice-container { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div class="company-info">
        <h1>${companyName}</h1>
        ${companyAddress ? `<p>${companyAddress}</p>` : ''}
        ${companyEmail ? `<p>${companyEmail}</p>` : ''}
        ${companyPhone ? `<p>${companyPhone}</p>` : ''}
      </div>
      <div class="invoice-title">
        <h2>INVOICE</h2>
        <div class="invoice-number">${invoice.invoice_number}</div>
        <div class="status ${invoice.status === 'paid' ? 'status-paid' : 'status-pending'}">${invoice.status}</div>
      </div>
    </div>

    <div class="details-row">
      <div class="detail-box">
        <h3>Bill To</h3>
        <p><strong>${invoice.customer_name || 'Customer'}</strong></p>
        <p>${invoice.customer_email || ''}</p>
        ${invoice.customer_address ? `<p>${invoice.customer_address}</p>` : ''}
      </div>
      <div class="detail-box">
        <h3>Invoice Details</h3>
        <p><strong>Invoice Date:</strong> ${invoiceDate}</p>
        <p><strong>Payment Date:</strong> ${paidDate}</p>
        <p><strong>Payment Method:</strong> ${invoice.payment_type.charAt(0).toUpperCase() + invoice.payment_type.slice(1)}</p>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Quantity</th>
          <th>Unit Price</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>${invoice.description || 'Document Check Credits'}</strong>
            <br><span style="color: #666; font-size: 13px;">${invoice.credits} Credits</span>
          </td>
          <td>1</td>
          <td>$${Number(invoice.amount_usd).toFixed(2)}</td>
          <td class="amount">$${Number(invoice.amount_usd).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>$${Number(invoice.amount_usd).toFixed(2)}</span>
      </div>
      <div class="totals-row">
        <span>Tax (0%)</span>
        <span>$0.00</span>
      </div>
      <div class="totals-row total">
        <span>Total</span>
        <span>$${Number(invoice.amount_usd).toFixed(2)}</span>
      </div>
    </div>

    ${invoice.notes ? `
    <div class="payment-info">
      <h4>Notes</h4>
      <p>${invoice.notes}</p>
    </div>
    ` : ''}

    <div class="footer">
      <p>Thank you for your business!</p>
      <p>If you have any questions about this invoice, please contact us at ${companyEmail}</p>
    </div>
  </div>
</body>
</html>
    `;

    logStep("PDF HTML generated successfully");

    return new Response(JSON.stringify({ 
      success: true, 
      html: htmlContent,
      invoice: {
        invoice_number: invoice.invoice_number,
        amount_usd: invoice.amount_usd,
        credits: invoice.credits,
        status: invoice.status,
        created_at: invoice.created_at
      }
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
