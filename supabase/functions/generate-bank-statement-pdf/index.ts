import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  console.log(`[BANK-STATEMENT-PDF] ${step}:`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    // Verify admin role
    const { data: role } = await supabase.rpc('get_user_role', { _user_id: user.id });
    if (role !== 'admin') {
      throw new Error('Unauthorized: Admin access required');
    }

    const { statementId } = await req.json();
    logStep('Generating PDF for statement', { statementId });

    // Fetch statement data
    const { data: statement, error: stmtError } = await supabase
      .from('bank_statements')
      .select('*')
      .eq('id', statementId)
      .single();

    if (stmtError || !statement) {
      throw new Error('Statement not found');
    }

    // Fetch entries
    const { data: entries, error: entriesError } = await supabase
      .from('bank_statement_entries')
      .select('*')
      .eq('statement_id', statementId)
      .order('entry_date', { ascending: true });

    if (entriesError) {
      throw new Error('Failed to fetch entries');
    }

    // Format currency
    const formatCurrency = (amount: number, currency: string) => {
      const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€' };
      return `${symbols[currency] || currency} ${amount.toFixed(2)}`;
    };

    // Format date
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    // Generate entries HTML
    let entriesHtml = '';
    entries?.forEach((entry: any) => {
      const isCredit = entry.entry_type === 'credit';
      entriesHtml += `
        <tr>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb;">${formatDate(entry.entry_date)}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb;">${entry.description}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-size: 11px;">${entry.reference || '-'}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: ${isCredit ? '#059669' : '#dc2626'};">
            ${isCredit ? '+' : '-'}${formatCurrency(entry.amount, statement.currency)}
          </td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">
            ${entry.running_balance !== null ? formatCurrency(entry.running_balance, statement.currency) : '-'}
          </td>
        </tr>
      `;
    });

    // Build full HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bank Statement ${statement.statement_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1f2937; line-height: 1.5; }
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body style="padding: 40px;">
  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #1e40af; padding-bottom: 20px;">
    <div>
      ${statement.bank_logo_url ? `<img src="${statement.bank_logo_url}" alt="Bank Logo" style="max-height: 50px; margin-bottom: 10px;">` : ''}
      <h1 style="font-size: 24px; color: #1e40af; margin-bottom: 5px;">${statement.bank_name}</h1>
      <p style="color: #6b7280;">${statement.bank_country}</p>
    </div>
    <div style="text-align: right;">
      <h2 style="font-size: 18px; color: #374151; margin-bottom: 5px;">BANK STATEMENT</h2>
      <p style="font-size: 14px; color: #1e40af; font-weight: bold;">${statement.statement_number}</p>
      <p style="color: #6b7280; margin-top: 5px;">Statement Date: ${formatDate(statement.statement_date)}</p>
    </div>
  </div>

  <!-- Account Details -->
  <div style="display: flex; gap: 40px; margin-bottom: 30px;">
    <div style="flex: 1; background: #f9fafb; padding: 15px; border-radius: 8px;">
      <h3 style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 10px;">Account Holder</h3>
      <p style="font-size: 14px; font-weight: 600; color: #111827;">${statement.account_name}</p>
      ${statement.account_number ? `<p style="color: #4b5563; margin-top: 5px;">Account: ${statement.account_number}</p>` : ''}
      ${statement.sort_code ? `<p style="color: #4b5563;">Sort Code: ${statement.sort_code}</p>` : ''}
      ${statement.iban ? `<p style="color: #4b5563;">IBAN: ${statement.iban}</p>` : ''}
      ${statement.swift_code ? `<p style="color: #4b5563;">SWIFT: ${statement.swift_code}</p>` : ''}
    </div>
    <div style="flex: 1; background: #f9fafb; padding: 15px; border-radius: 8px;">
      <h3 style="font-size: 12px; color: #6b7280; text-transform: uppercase; margin-bottom: 10px;">Statement Period</h3>
      <p style="font-size: 14px; font-weight: 600; color: #111827;">${formatDate(statement.period_start)} - ${formatDate(statement.period_end)}</p>
      <p style="color: #4b5563; margin-top: 5px;">Currency: ${statement.currency}</p>
    </div>
  </div>

  <!-- Summary -->
  <div style="display: flex; gap: 20px; margin-bottom: 30px;">
    <div style="flex: 1; background: #ecfdf5; padding: 15px; border-radius: 8px; border-left: 4px solid #059669;">
      <p style="color: #065f46; font-size: 11px; text-transform: uppercase;">Opening Balance</p>
      <p style="font-size: 18px; font-weight: bold; color: #047857;">${formatCurrency(statement.opening_balance, statement.currency)}</p>
    </div>
    <div style="flex: 1; background: #ecfdf5; padding: 15px; border-radius: 8px; border-left: 4px solid #059669;">
      <p style="color: #065f46; font-size: 11px; text-transform: uppercase;">Total Credits</p>
      <p style="font-size: 18px; font-weight: bold; color: #059669;">+${formatCurrency(statement.total_credits, statement.currency)}</p>
    </div>
    <div style="flex: 1; background: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #dc2626;">
      <p style="color: #991b1b; font-size: 11px; text-transform: uppercase;">Total Debits</p>
      <p style="font-size: 18px; font-weight: bold; color: #dc2626;">-${formatCurrency(statement.total_debits, statement.currency)}</p>
    </div>
    <div style="flex: 1; background: #eff6ff; padding: 15px; border-radius: 8px; border-left: 4px solid #1e40af;">
      <p style="color: #1e40af; font-size: 11px; text-transform: uppercase;">Closing Balance</p>
      <p style="font-size: 18px; font-weight: bold; color: #1e3a8a;">${formatCurrency(statement.closing_balance, statement.currency)}</p>
    </div>
  </div>

  <!-- Transactions Table -->
  <h3 style="font-size: 14px; color: #374151; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb;">Transaction Details</h3>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
    <thead>
      <tr style="background: #f3f4f6;">
        <th style="padding: 12px 8px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #d1d5db;">Date</th>
        <th style="padding: 12px 8px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #d1d5db;">Description</th>
        <th style="padding: 12px 8px; text-align: left; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #d1d5db;">Reference</th>
        <th style="padding: 12px 8px; text-align: right; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #d1d5db;">Amount</th>
        <th style="padding: 12px 8px; text-align: right; font-size: 11px; color: #6b7280; text-transform: uppercase; border-bottom: 2px solid #d1d5db;">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${entriesHtml || '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #9ca3af;">No transactions in this period</td></tr>'}
    </tbody>
  </table>

  ${statement.notes ? `
  <div style="background: #fffbeb; padding: 15px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #f59e0b;">
    <h4 style="font-size: 12px; color: #92400e; margin-bottom: 5px;">Notes</h4>
    <p style="color: #78350f;">${statement.notes}</p>
  </div>
  ` : ''}

  <!-- Footer -->
  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 10px;">
    <p>This statement is generated electronically and is valid without a signature.</p>
    <p style="margin-top: 5px;">Generated on ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
  </div>
</body>
</html>
    `;

    logStep('PDF HTML generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        html,
        filename: `Statement_${statement.statement_number}.pdf`,
        statement: {
          number: statement.statement_number,
          period: `${formatDate(statement.period_start)} - ${formatDate(statement.period_end)}`,
          balance: formatCurrency(statement.closing_balance, statement.currency)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[BANK-STATEMENT-PDF] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
