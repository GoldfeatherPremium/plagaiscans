

# Fix Currency Display and Tax/VAT Calculation from Paddle Data

## Problem
1. Payments in non-USD currencies (GBP, CAD, etc.) are stored with `amount_usd` field name but actually contain the local currency amount, causing confusion
2. Invoices and receipts show VAT as 0 even though Paddle already calculates and collects tax (e.g., 20% UK VAT, 13% Canadian tax)
3. Currency display is inconsistent across the app

## Discovery
Paddle's webhook payload already includes detailed tax breakdowns:
- **GBP example**: subtotal=14.68, tax=2.94 (20%), total=17.62
- **CAD example**: subtotal=27.21, tax=3.54 (13%), total=30.75

We do NOT need live currency conversion -- Paddle provides the exact tax amounts in the customer's currency.

## Changes

### 1. Paddle Webhook (`supabase/functions/paddle-webhook/index.ts`)
Extract tax data from `eventData.details.totals` and `eventData.details.tax_rates_used`:
- `subtotal` = totals.subtotal / 100
- `tax` = totals.tax / 100
- `taxRate` = tax_rates_used[0].tax_rate (e.g., 0.2 for 20%)

Pass these values when calling `create-invoice` and `create-receipt`:
- `subtotal` (pre-tax amount)
- `vat_amount` (tax amount)
- `vat_rate` (tax percentage, e.g., 20)
- `amount_usd` remains the total paid (including tax)

### 2. Invoice PDF (`supabase/functions/generate-invoice-pdf/index.ts`)
No structural changes needed -- it already renders VAT rows. The data will now flow correctly from the webhook.

### 3. Receipt PDF (`supabase/functions/generate-receipt-pdf/index.ts`)
Same as above -- already has VAT rendering logic. Will now show correct values.

### 4. Payment History (`src/pages/PaymentHistory.tsx`)
- Remove the "$" prefix for non-USD currencies (already partially done)
- Ensure consistent display: show currency symbol + amount + currency code

### 5. My Invoices (`src/pages/MyInvoices.tsx`)
- Add `currency` field to the Invoice interface (fetch from DB)
- Display amounts using the correct currency symbol instead of hardcoded "$"

### 6. My Receipts (`src/pages/MyReceipts.tsx`)
- Already handles currency well -- minor cleanup to ensure consistency

### 7. Admin Unified Payments (`src/pages/AdminUnifiedPayments.tsx`)
- Already fixed in previous change -- no additional work needed

## Technical Details

### Paddle webhook data extraction (key change):
```
const totals = eventData?.details?.totals;
const taxRates = eventData?.details?.tax_rates_used;
const subtotalAmount = totals?.subtotal ? parseFloat(totals.subtotal) / 100 : amountTotal;
const taxAmount = totals?.tax ? parseFloat(totals.tax) / 100 : 0;
const taxRate = taxRates?.[0]?.tax_rate ? taxRates[0].tax_rate * 100 : 0;
```

### Files to modify:
1. `supabase/functions/paddle-webhook/index.ts` -- extract and pass tax data
2. `src/pages/MyInvoices.tsx` -- add currency-aware display
3. `src/pages/PaymentHistory.tsx` -- minor currency display fix
4. Redeploy `paddle-webhook` edge function

### No database changes needed
All required columns (`vat_rate`, `vat_amount`, `subtotal`, `currency`) already exist in both `invoices` and `receipts` tables.

