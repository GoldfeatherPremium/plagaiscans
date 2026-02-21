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

// UK Business Details
const COMPANY = {
  legalName: "Plagaiscans Technologies Ltd",
  tradingName: "Plagaiscans",
  companyNumber: "16113228",
  country: "United Kingdom",
  email: "support@plagaiscans.com",
  website: "https://plagaiscans.com",
  vatNumber: null as string | null, // Set when VAT registered
  isVatRegistered: false,
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

    // Format dates
    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    };

    const invoiceDate = formatDate(invoice.created_at);
    const paymentDate = invoice.paid_at ? formatDate(invoice.paid_at) : invoiceDate;

    // Calculate amounts - use amount_usd as the authoritative total paid
    const vatRate = Number(invoice.vat_rate || 0);
    const vatAmount = Number(invoice.vat_amount || 0);
    const totalAmount = Number(invoice.amount_usd);
    // Subtotal: if stored separately use it, otherwise derive from total minus tax
    const subtotal = Number(invoice.subtotal || (totalAmount - vatAmount));
    const unitPrice = Number(invoice.unit_price || subtotal);
    const quantity = invoice.quantity || 1;
    const currency = invoice.currency || 'USD';

    // Currency symbol
    const currencySymbols: Record<string, string> = {
      USD: '$', GBP: '£', EUR: '€', AED: 'د.إ', INR: '₹',
      CAD: 'C$', AUD: 'A$', SGD: 'S$', CHF: 'Fr', JPY: '¥', CNY: '¥'
    };
    const currencySymbol = currencySymbols[currency] || '$';

    // Payment method display
    const paymentMethodDisplay = (type: string) => {
      switch (type) {
        case 'stripe': return 'Card (Stripe)';
        case 'crypto': return 'Cryptocurrency';
        case 'manual': return 'Bank Transfer';
        case 'usdt_trc20': return 'USDT (TRC20)';
        default: return type.charAt(0).toUpperCase() + type.slice(1);
      }
    };

    // VAT section HTML
    const vatSection = COMPANY.isVatRegistered ? `
      <div class="vat-info">
        <p><strong>VAT Number:</strong> ${COMPANY.vatNumber}</p>
      </div>
    ` : '';

    const vatRowHtml = vatRate > 0 ? `
      <div class="totals-row">
        <span>VAT (${vatRate}%)</span>
        <span>${currencySymbol}${vatAmount.toFixed(2)}</span>
      </div>
    ` : `
      <div class="totals-row vat-note">
        <span colspan="2" style="font-size: 11px; color: #666;">VAT not applicable under current UK tax regulations.</span>
      </div>
    `;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoice_number} - Plagaiscans</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Oxygen, Ubuntu, sans-serif; 
      color: #1a1a1a; 
      line-height: 1.6; 
      background: #fff;
    }
    .invoice-container { 
      max-width: 800px; 
      margin: 0 auto; 
      padding: 40px; 
    }
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start; 
      margin-bottom: 40px; 
      padding-bottom: 30px; 
      border-bottom: 2px solid #e5e7eb; 
    }
    .company-info h1 { 
      font-size: 24px; 
      color: #1e40af; 
      margin-bottom: 4px; 
      font-weight: 700;
    }
    .company-info .trading-name { 
      font-size: 14px; 
      color: #6b7280; 
      margin-bottom: 8px;
    }
    .company-info p { 
      color: #6b7280; 
      font-size: 12px; 
      line-height: 1.4;
    }
    .invoice-title { text-align: right; }
    .invoice-title h2 { 
      font-size: 28px; 
      color: #111827; 
      margin-bottom: 8px; 
      font-weight: 600;
      letter-spacing: 2px;
    }
    .invoice-title .invoice-number { 
      font-size: 16px; 
      color: #1e40af; 
      font-weight: 600; 
      font-family: 'Courier New', monospace;
    }
    .invoice-title .status { 
      display: inline-block; 
      padding: 6px 16px; 
      border-radius: 4px; 
      font-size: 11px; 
      font-weight: 600; 
      text-transform: uppercase; 
      margin-top: 12px;
      letter-spacing: 0.5px;
    }
    .status-paid { background: #dcfce7; color: #166534; }
    .status-pending { background: #fef3c7; color: #92400e; }
    
    .details-section { 
      display: flex; 
      justify-content: space-between; 
      margin-bottom: 35px; 
      gap: 40px;
    }
    .detail-box { flex: 1; }
    .detail-box h3 { 
      font-size: 10px; 
      text-transform: uppercase; 
      color: #9ca3af; 
      letter-spacing: 1.5px; 
      margin-bottom: 10px;
      font-weight: 600;
    }
    .detail-box p { 
      color: #374151; 
      font-size: 13px;
      margin-bottom: 4px;
    }
    .detail-box p strong { color: #111827; }
    
    .items-table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-bottom: 25px; 
    }
    .items-table th { 
      background: #f9fafb; 
      padding: 12px 14px; 
      text-align: left; 
      font-size: 10px; 
      text-transform: uppercase; 
      color: #6b7280; 
      letter-spacing: 0.8px;
      font-weight: 600;
      border-bottom: 1px solid #e5e7eb;
    }
    .items-table th.amount { text-align: right; }
    .items-table td { 
      padding: 16px 14px; 
      border-bottom: 1px solid #f3f4f6; 
      font-size: 13px;
      color: #374151;
    }
    .items-table td.amount { 
      text-align: right; 
      font-weight: 600;
      color: #111827;
    }
    .items-table .description-cell strong {
      display: block;
      color: #111827;
      margin-bottom: 2px;
    }
    .items-table .description-cell span {
      color: #6b7280;
      font-size: 12px;
    }
    
    .totals { 
      margin-left: auto; 
      width: 280px; 
      background: #f9fafb;
      padding: 20px;
      border-radius: 6px;
    }
    .totals-row { 
      display: flex; 
      justify-content: space-between; 
      padding: 8px 0; 
      font-size: 13px;
      color: #374151;
    }
    .totals-row.total { 
      border-top: 2px solid #e5e7eb; 
      font-size: 16px; 
      font-weight: 700;
      color: #111827;
      padding-top: 12px;
      margin-top: 8px;
    }
    .totals-row.vat-note {
      display: block;
      padding: 6px 0;
    }
    
    .payment-details {
      background: #eff6ff;
      border-radius: 6px;
      padding: 16px 20px;
      margin: 30px 0;
    }
    .payment-details h4 {
      color: #1e40af;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 10px;
    }
    .payment-details p {
      font-size: 12px;
      color: #1e3a8a;
      margin-bottom: 4px;
    }
    
    .footer { 
      margin-top: 50px; 
      padding-top: 25px; 
      border-top: 1px solid #e5e7eb; 
      text-align: center;
    }
    .footer-company {
      margin-bottom: 15px;
    }
    .footer-company p {
      font-size: 11px;
      color: #6b7280;
      line-height: 1.6;
    }
    .footer-company p strong {
      color: #374151;
    }
    .footer-legal {
      font-size: 10px;
      color: #9ca3af;
      font-style: italic;
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px dashed #e5e7eb;
    }
    
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
        <h1>Plagaiscans</h1>
        <p class="trading-name">Trading name of ${COMPANY.legalName}</p>
        <p>${COMPANY.email}</p>
        <p>${COMPANY.website}</p>
        ${vatSection}
      </div>
      <div class="invoice-title">
        <h2>INVOICE</h2>
        <div class="invoice-number">${invoice.invoice_number}</div>
        <div class="status ${invoice.status === 'paid' ? 'status-paid' : 'status-pending'}">
          ${invoice.status.toUpperCase()}
        </div>
      </div>
    </div>

    <div class="details-section">
      <div class="detail-box">
        <h3>Bill To</h3>
        <p><strong>${invoice.customer_name || 'Guest Customer'}</strong></p>
        <p>${invoice.customer_email || ''}</p>
        ${invoice.customer_country ? `<p>${invoice.customer_country}</p>` : ''}
        ${invoice.customer_address ? `<p>${invoice.customer_address}</p>` : ''}
      </div>
      <div class="detail-box">
        <h3>Invoice Details</h3>
        <p><strong>Invoice Date:</strong> ${invoiceDate}</p>
        <p><strong>Payment Date:</strong> ${paymentDate}</p>
        <p><strong>Currency:</strong> ${currency}</p>
      </div>
    </div>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 50%;">Description</th>
          <th style="width: 15%;">Quantity</th>
          <th style="width: 15%;">Unit Price</th>
          <th class="amount" style="width: 20%;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="description-cell">
            <strong>${invoice.description || 'Plagiarism & AI Content Analysis Service'}</strong>
            <span>${invoice.credits} Document Check Credits</span>
          </td>
          <td>${quantity}</td>
          <td>${currencySymbol}${unitPrice.toFixed(2)}</td>
          <td class="amount">${currencySymbol}${subtotal.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>${currencySymbol}${subtotal.toFixed(2)}</span>
      </div>
      ${vatRowHtml}
      <div class="totals-row total">
        <span>Total Paid</span>
        <span>${currencySymbol}${totalAmount.toFixed(2)}</span>
      </div>
    </div>

    <div class="payment-details">
      <h4>Payment Information</h4>
      <p><strong>Payment Method:</strong> ${paymentMethodDisplay(invoice.payment_type)}</p>
      ${invoice.transaction_id ? `<p><strong>Transaction ID:</strong> ${invoice.transaction_id}</p>` : ''}
      ${invoice.payment_id ? `<p><strong>Reference:</strong> ${invoice.payment_id}</p>` : ''}
    </div>

    <div class="footer">
      <div class="footer-company">
        <p><strong>${COMPANY.legalName}</strong></p>
        <p>Company Number: ${COMPANY.companyNumber}</p>
        <p>Registered in the ${COMPANY.country}</p>
        <p>Operating as: ${COMPANY.tradingName}</p>
        <p>${COMPANY.email} | ${COMPANY.website}</p>
      </div>
      <div class="footer-legal">
        <p>This invoice is generated electronically and is valid without a signature.</p>
        <p>Plagaiscans is a trading name of ${COMPANY.legalName}, a company registered in the ${COMPANY.country}.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    logStep("PDF HTML generated successfully");

    return new Response(JSON.stringify({ 
      success: true, 
      html: htmlContent,
      fileName: `Invoice_${invoice.invoice_number}_Plagaiscans.pdf`,
      invoice: {
        invoice_number: invoice.invoice_number,
        amount_usd: invoice.amount_usd,
        credits: invoice.credits,
        status: invoice.status,
        created_at: invoice.created_at,
        currency: currency
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
