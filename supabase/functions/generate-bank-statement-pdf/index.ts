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
      const symbols: Record<string, string> = { 
        GBP: '£', USD: '$', EUR: '€', AED: 'د.إ', INR: '₹',
        CAD: 'C$', AUD: 'A$', SGD: 'S$', CHF: 'Fr', JPY: '¥', CNY: '¥'
      };
      return `${symbols[currency] || currency} ${amount.toFixed(2)}`;
    };

    // Format date
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    // Format time
    const formatTime = (timeStr: string | null) => {
      if (!timeStr) return '';
      // timeStr is in format HH:MM:SS
      const [hours, minutes] = timeStr.split(':');
      return `${hours}:${minutes}`;
    };


    // Calculate running balance for each entry if not set
    let runningBalance = statement.opening_balance;
    const processedEntries = entries?.map((entry: any) => {
      if (entry.entry_type === 'credit') {
        runningBalance += entry.amount;
      } else {
        runningBalance -= entry.amount;
      }
      return { ...entry, calculated_balance: entry.running_balance ?? runningBalance };
    }) || [];

    // Generate entries HTML with professional styling
    let entriesHtml = '';
    processedEntries.forEach((entry: any, index: number) => {
      const isCredit = entry.entry_type === 'credit';
      const entryTime = entry.entry_time ? formatTime(entry.entry_time) : '';
      const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      entriesHtml += `
        <tr style="background: ${rowBg};">
          <td style="padding: 14px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
            <div style="font-weight: 500; color: #1e293b;">${formatDate(entry.entry_date)}</div>
            ${entryTime ? `<div style="color: #64748b; font-size: 10px; margin-top: 2px;">${entryTime}</div>` : ''}
          </td>
          <td style="padding: 14px 12px; border-bottom: 1px solid #e2e8f0;">
            <div style="font-family: 'SF Mono', 'Consolas', monospace; font-size: 9px; color: #475569; letter-spacing: 0.5px;">${entry.transaction_id || '—'}</div>
          </td>
          <td style="padding: 14px 12px; border-bottom: 1px solid #e2e8f0;">
            <div style="font-weight: 500; color: #1e293b;">${entry.description}</div>
            ${entry.reference ? `<div style="color: #64748b; font-size: 10px; margin-top: 3px;">Ref: ${entry.reference}</div>` : ''}
          </td>
          <td style="padding: 14px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">
            <span style="font-weight: 600; font-size: 12px; color: ${isCredit ? '#059669' : '#dc2626'};">
              ${isCredit ? '+' : '−'} ${formatCurrency(entry.amount, statement.currency)}
            </span>
          </td>
          <td style="padding: 14px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">
            <span style="font-weight: 600; font-size: 12px; color: #0f172a;">
              ${formatCurrency(entry.calculated_balance, statement.currency)}
            </span>
          </td>
        </tr>
      `;
    });

    // Build full HTML with professional bank statement design
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Bank Statement ${statement.statement_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; 
      font-size: 12px; 
      color: #1e293b; 
      line-height: 1.6;
      background: #ffffff;
    }
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body style="padding: 0;">
  <!-- Professional Header with Bank Branding -->
  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 35px 40px; color: white;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        ${statement.bank_logo_url ? `<img src="${statement.bank_logo_url}" alt="Bank Logo" style="max-height: 50px; max-width: 180px; margin-bottom: 12px; object-fit: contain; background: white; padding: 6px 10px; border-radius: 6px;">` : ''}
        <h1 style="font-size: 26px; font-weight: 700; letter-spacing: -0.5px; margin-bottom: 4px;">${statement.bank_name}</h1>
        <p style="color: rgba(255,255,255,0.7); font-size: 13px;">${statement.bank_country}</p>
      </div>
      <div style="text-align: right;">
        <div style="background: rgba(255,255,255,0.15); padding: 12px 20px; border-radius: 8px; backdrop-filter: blur(10px);">
          <p style="color: rgba(255,255,255,0.8); font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Statement Reference</p>
          <p style="font-size: 18px; font-weight: 700; letter-spacing: 1px;">${statement.statement_number}</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Statement Title Bar -->
  <div style="background: #f1f5f9; padding: 15px 40px; border-bottom: 1px solid #e2e8f0;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <h2 style="font-size: 16px; font-weight: 600; color: #334155;">Account Statement</h2>
      <p style="color: #64748b; font-size: 12px;">Statement Date: <strong style="color: #1e293b;">${formatDate(statement.statement_date)}</strong></p>
    </div>
  </div>

  <div style="padding: 35px 40px;">
    <!-- Account Information Grid -->
    <div style="display: flex; gap: 30px; margin-bottom: 35px;">
      <div style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
          <div style="width: 8px; height: 8px; background: #0ea5e9; border-radius: 50%;"></div>
          <h3 style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Account Holder</h3>
        </div>
        <p style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">${statement.account_name}</p>
        <div style="display: grid; gap: 6px;">
          ${statement.account_number ? `<div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Account Number</span><span style="font-weight: 600; font-family: monospace;">${statement.account_number}</span></div>` : ''}
          ${statement.sort_code ? `<div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Sort Code</span><span style="font-weight: 600; font-family: monospace;">${statement.sort_code}</span></div>` : ''}
          ${statement.iban ? `<div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">IBAN</span><span style="font-weight: 600; font-family: monospace; font-size: 10px;">${statement.iban}</span></div>` : ''}
          ${statement.swift_code ? `<div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">SWIFT/BIC</span><span style="font-weight: 600; font-family: monospace;">${statement.swift_code}</span></div>` : ''}
        </div>
      </div>
      <div style="flex: 1; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
          <div style="width: 8px; height: 8px; background: #8b5cf6; border-radius: 50%;"></div>
          <h3 style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Statement Period</h3>
        </div>
        <p style="font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 12px;">
          ${formatDate(statement.period_start)} — ${formatDate(statement.period_end)}
        </p>
        <div style="display: grid; gap: 6px;">
          <div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Currency</span><span style="font-weight: 600;">${statement.currency}</span></div>
          <div style="display: flex; justify-content: space-between;"><span style="color: #64748b;">Total Transactions</span><span style="font-weight: 600;">${entries?.length || 0}</span></div>
        </div>
      </div>
    </div>

    <!-- Balance Summary Cards -->
    <div style="display: flex; gap: 16px; margin-bottom: 35px;">
      <div style="flex: 1; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 20px; border: 1px solid #bbf7d0;">
        <p style="color: #166534; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 8px;">Opening Balance</p>
        <p style="font-size: 24px; font-weight: 800; color: #14532d;">${formatCurrency(statement.opening_balance, statement.currency)}</p>
      </div>
      <div style="flex: 1; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 20px; border: 1px solid #a7f3d0;">
        <p style="color: #047857; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 8px;">Money In</p>
        <p style="font-size: 24px; font-weight: 800; color: #065f46;">+ ${formatCurrency(statement.total_credits, statement.currency)}</p>
      </div>
      <div style="flex: 1; background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%); border-radius: 12px; padding: 20px; border: 1px solid #fca5a5;">
        <p style="color: #b91c1c; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 8px;">Money Out</p>
        <p style="font-size: 24px; font-weight: 800; color: #991b1b;">− ${formatCurrency(statement.total_debits, statement.currency)}</p>
      </div>
      <div style="flex: 1; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 12px; padding: 20px; color: white;">
        <p style="color: rgba(255,255,255,0.8); font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 8px;">Closing Balance</p>
        <p style="font-size: 24px; font-weight: 800;">${formatCurrency(statement.closing_balance, statement.currency)}</p>
      </div>
    </div>

    <!-- Transactions Section -->
    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
      <div style="background: #f8fafc; padding: 16px 20px; border-bottom: 1px solid #e2e8f0;">
        <h3 style="font-size: 14px; font-weight: 700; color: #0f172a;">Transaction History</h3>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 14px 12px; text-align: left; font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; border-bottom: 2px solid #e2e8f0; width: 110px;">Date</th>
            <th style="padding: 14px 12px; text-align: left; font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; border-bottom: 2px solid #e2e8f0; width: 180px;">Transaction ID</th>
            <th style="padding: 14px 12px; text-align: left; font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; border-bottom: 2px solid #e2e8f0;">Description</th>
            <th style="padding: 14px 12px; text-align: right; font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; border-bottom: 2px solid #e2e8f0; width: 120px;">Amount</th>
            <th style="padding: 14px 12px; text-align: right; font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; border-bottom: 2px solid #e2e8f0; width: 120px;">Balance</th>
          </tr>
        </thead>
        <tbody>
          ${entriesHtml || `
            <tr>
              <td colspan="5" style="padding: 40px; text-align: center; color: #94a3b8;">
                <div style="font-size: 14px; margin-bottom: 4px;">No transactions</div>
                <div style="font-size: 11px;">No transactions recorded for this statement period</div>
              </td>
            </tr>
          `}
        </tbody>
      </table>
    </div>

    ${statement.notes ? `
    <!-- Notes Section -->
    <div style="margin-top: 25px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 20px;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        <div style="width: 8px; height: 8px; background: #f59e0b; border-radius: 50%;"></div>
        <h4 style="font-size: 12px; color: #92400e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Important Notes</h4>
      </div>
      <p style="color: #78350f; font-size: 12px; line-height: 1.6;">${statement.notes}</p>
    </div>
    ` : ''}
  </div>

  <!-- Professional Footer -->
  <div style="background: #f8fafc; padding: 25px 40px; border-top: 1px solid #e2e8f0; margin-top: 20px;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <p style="color: #64748b; font-size: 10px; margin-bottom: 4px;">This is an electronically generated statement and does not require a signature.</p>
        <p style="color: #94a3b8; font-size: 9px;">Please retain this statement for your records. Report any discrepancies within 30 days.</p>
      </div>
      <div style="text-align: right;">
        <p style="color: #64748b; font-size: 10px;">Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        <p style="color: #94a3b8; font-size: 9px;">${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} UTC</p>
      </div>
    </div>
  </div>

  <!-- Security Watermark -->
  <div style="text-align: center; padding: 15px; background: #0f172a; color: rgba(255,255,255,0.6); font-size: 9px; letter-spacing: 2px;">
    CONFIDENTIAL BANKING DOCUMENT • ${statement.bank_name.toUpperCase()} • ${statement.statement_number}
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
