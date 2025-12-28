import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RECEIPT-PDF] ${step}${detailsStr}`);
};

// UK Company Details
const COMPANY = {
  legalName: 'Goldfeather Prem Ltd',
  tradingName: 'Plagaiscans',
  companyNumber: '16288657',
  country: 'United Kingdom',
  email: 'support@plagaiscans.com',
  website: 'https://plagaiscans.com',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Starting receipt PDF generation');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { receiptId } = await req.json();
    logStep('Receipt ID received', { receiptId });

    if (!receiptId) {
      throw new Error('Receipt ID is required');
    }

    // Fetch receipt details
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .single();

    if (receiptError || !receipt) {
      logStep('Receipt fetch error', { error: receiptError });
      throw new Error('Receipt not found');
    }

    // Verify user has access (owner or admin)
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (receipt.user_id !== user.id && userRole?.role !== 'admin') {
      throw new Error('Unauthorized to access this receipt');
    }

    logStep('Receipt found', { receipt_number: receipt.receipt_number });

    // Format dates
    const receiptDate = new Date(receipt.receipt_date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    // Calculate amounts
    const subtotal = receipt.subtotal || receipt.amount_paid;
    const vatAmount = receipt.vat_amount || 0;
    const totalAmount = receipt.amount_paid;
    const currencySymbols: Record<string, string> = {
      USD: '$', GBP: '£', EUR: '€', AED: 'د.إ', INR: '₹',
      CAD: 'C$', AUD: 'A$', SGD: 'S$', CHF: 'Fr', JPY: '¥', CNY: '¥'
    };
    const currencySymbol = currencySymbols[receipt.currency || 'USD'] || '$';

    // Generate HTML for receipt
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt ${receipt.receipt_number}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      background: #fff;
      padding: 40px;
    }
    .receipt-container {
      max-width: 800px;
      margin: 0 auto;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #fff;
      padding: 30px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .header-left h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .header-left p {
      font-size: 12px;
      opacity: 0.8;
    }
    .header-right {
      text-align: right;
    }
    .header-right .receipt-label {
      font-size: 24px;
      font-weight: 700;
      color: #4ade80;
    }
    .header-right .receipt-number {
      font-size: 14px;
      opacity: 0.9;
      margin-top: 5px;
    }
    .paid-badge {
      display: inline-block;
      background: #22c55e;
      color: #fff;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 8px;
    }
    .content {
      padding: 40px;
    }
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .info-block h3 {
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    .info-block p {
      font-size: 14px;
      color: #333;
      margin-bottom: 4px;
    }
    .info-block .highlight {
      font-weight: 600;
      color: #1a1a2e;
    }
    .table-container {
      margin: 30px 0;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead {
      background: #f8f9fa;
    }
    th {
      padding: 14px 16px;
      text-align: left;
      font-size: 12px;
      text-transform: uppercase;
      color: #666;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    th:last-child {
      text-align: right;
    }
    td {
      padding: 16px;
      border-top: 1px solid #e0e0e0;
    }
    td:last-child {
      text-align: right;
    }
    .description-cell {
      font-weight: 500;
    }
    .totals {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
    }
    .totals-table {
      width: 300px;
    }
    .totals-table tr td {
      padding: 8px 16px;
      border: none;
    }
    .totals-table tr td:first-child {
      color: #666;
    }
    .totals-table tr td:last-child {
      font-weight: 500;
    }
    .totals-table .total-row td {
      font-size: 16px;
      font-weight: 700;
      color: #1a1a2e;
      border-top: 2px solid #1a1a2e;
      padding-top: 12px;
    }
    .payment-info {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-top: 30px;
    }
    .payment-info h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #1a1a2e;
    }
    .payment-info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .payment-info-item {
      display: flex;
      justify-content: space-between;
    }
    .payment-info-item .label {
      color: #666;
      font-size: 13px;
    }
    .payment-info-item .value {
      font-weight: 500;
      font-size: 13px;
    }
    .footer {
      background: #f8f9fa;
      padding: 30px 40px;
      border-top: 1px solid #e0e0e0;
    }
    .footer-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .footer-left {
      font-size: 12px;
      color: #666;
      line-height: 1.8;
    }
    .footer-left strong {
      color: #333;
    }
    .footer-right {
      text-align: right;
      font-size: 12px;
      color: #666;
    }
    .footer-right a {
      color: #2563eb;
      text-decoration: none;
    }
    .footer-note {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      font-size: 11px;
      color: #888;
      text-align: center;
      font-style: italic;
    }
    .thank-you {
      text-align: center;
      margin-top: 30px;
      padding: 20px;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border-radius: 8px;
      border: 1px solid #bbf7d0;
    }
    .thank-you h3 {
      color: #166534;
      font-size: 18px;
      margin-bottom: 8px;
    }
    .thank-you p {
      color: #15803d;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <div class="header-left">
        <h1>${COMPANY.tradingName}</h1>
        <p>Plagiarism & AI Content Analysis Service</p>
      </div>
      <div class="header-right">
        <div class="receipt-label">RECEIPT</div>
        <div class="receipt-number">${receipt.receipt_number}</div>
        <div class="paid-badge">✓ PAYMENT CONFIRMED</div>
      </div>
    </div>
    
    <div class="content">
      <div class="info-section">
        <div class="info-block">
          <h3>Receipt Date</h3>
          <p class="highlight">${receiptDate}</p>
        </div>
        <div class="info-block">
          <h3>Received From</h3>
          <p class="highlight">${receipt.customer_name || 'Customer'}</p>
          <p>${receipt.customer_email || 'N/A'}</p>
          ${receipt.customer_country ? `<p>${receipt.customer_country}</p>` : ''}
        </div>
        <div class="info-block">
          <h3>Received By</h3>
          <p class="highlight">${COMPANY.legalName}</p>
          <p>Trading as: ${COMPANY.tradingName}</p>
          <p>United Kingdom</p>
        </div>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="description-cell">${receipt.description || 'Plagiarism & AI Content Analysis Service'}</td>
              <td>${receipt.quantity || receipt.credits} credits</td>
              <td>${currencySymbol}${(receipt.unit_price || (subtotal / (receipt.quantity || receipt.credits))).toFixed(2)}</td>
              <td>${currencySymbol}${Number(subtotal).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="totals">
        <table class="totals-table">
          <tr>
            <td>Subtotal</td>
            <td>${currencySymbol}${Number(subtotal).toFixed(2)}</td>
          </tr>
          ${Number(vatAmount) > 0 ? `
          <tr>
            <td>VAT (${receipt.vat_rate || 0}%)</td>
            <td>${currencySymbol}${Number(vatAmount).toFixed(2)}</td>
          </tr>
          ` : `
          <tr>
            <td>VAT</td>
            <td>N/A</td>
          </tr>
          `}
          <tr class="total-row">
            <td>Amount Paid</td>
            <td>${currencySymbol}${Number(totalAmount).toFixed(2)} ${receipt.currency}</td>
          </tr>
        </table>
      </div>

      <div class="payment-info">
        <h3>Payment Details</h3>
        <div class="payment-info-grid">
          <div class="payment-info-item">
            <span class="label">Payment Method:</span>
            <span class="value">${receipt.payment_method}</span>
          </div>
          <div class="payment-info-item">
            <span class="label">Transaction ID:</span>
            <span class="value">${receipt.transaction_id || receipt.payment_id || 'N/A'}</span>
          </div>
          <div class="payment-info-item">
            <span class="label">Credits Added:</span>
            <span class="value">${receipt.credits} credits</span>
          </div>
          <div class="payment-info-item">
            <span class="label">Receipt Date:</span>
            <span class="value">${receiptDate}</span>
          </div>
        </div>
      </div>

      <div class="thank-you">
        <h3>Thank You for Your Payment!</h3>
        <p>Your credits have been added to your account and are ready to use.</p>
      </div>
    </div>

    <div class="footer">
      <div class="footer-content">
        <div class="footer-left">
          <strong>${COMPANY.legalName}</strong><br>
          Company Number: ${COMPANY.companyNumber}<br>
          Registered in the ${COMPANY.country}<br>
          Operating as: ${COMPANY.tradingName}
        </div>
        <div class="footer-right">
          <a href="mailto:${COMPANY.email}">${COMPANY.email}</a><br>
          <a href="${COMPANY.website}">${COMPANY.website}</a>
        </div>
      </div>
      <div class="footer-note">
        This receipt is generated electronically and confirms payment received. Keep this for your records.<br>
        ${COMPANY.tradingName} is a trading name of ${COMPANY.legalName}, a company registered in the United Kingdom.
      </div>
    </div>
  </div>
</body>
</html>`;

    logStep('Receipt HTML generated successfully');

    // Return the HTML (can be converted to PDF by client or external service)
    return new Response(
      JSON.stringify({
        success: true,
        html,
        filename: `Receipt_${receipt.receipt_number}_Plagaiscans.pdf`,
        receipt: {
          receipt_number: receipt.receipt_number,
          amount_paid: receipt.amount_paid,
          currency: receipt.currency,
          receipt_date: receipt.receipt_date
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('Error generating receipt PDF', { error: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
