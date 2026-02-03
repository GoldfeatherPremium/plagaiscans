
# Stripe Invoice & Receipt Integration Plan ✅ COMPLETED

## Status: IMPLEMENTED (Feb 2026)
Enhance the invoice and receipt system to fully integrate with Stripe's native invoicing and receipt capabilities, storing Stripe-specific identifiers and handling subscription invoice events.

---

## Database Changes

### 1. Add Stripe-Specific Columns to Invoices Table
| Column | Type | Purpose |
|--------|------|---------|
| `stripe_invoice_id` | TEXT | Store Stripe's invoice ID (e.g., `in_xxx`) |
| `stripe_invoice_url` | TEXT | URL to Stripe's hosted invoice page |
| `stripe_receipt_url` | TEXT | URL to Stripe's receipt page |

### 2. Add Stripe-Specific Columns to Receipts Table
| Column | Type | Purpose |
|--------|------|---------|
| `stripe_receipt_url` | TEXT | URL to Stripe's hosted receipt |
| `stripe_charge_id` | TEXT | Stripe charge ID for reference |

---

## Webhook Handler Updates

### Handle `invoice.paid` Event (for Subscriptions)
When a subscription invoice is paid:
1. Extract invoice details from Stripe event
2. Find user by customer email
3. Create invoice record with Stripe invoice URL
4. Create receipt record with Stripe receipt URL
5. Notify user of successful subscription payment

### Enhance `checkout.session.completed` Handler
- Retrieve Stripe charge receipt URL
- Pass receipt URL to `create-invoice` and `create-receipt` functions
- Store Stripe session ID as reference

### Handle `charge.succeeded` Event Enhancement
- Update existing receipts with Stripe receipt URL when charge completes

---

## Edge Function Updates

### Update `create-invoice` Function
- Accept new parameters: `stripe_invoice_id`, `stripe_invoice_url`, `stripe_receipt_url`
- Store these in the invoice record

### Update `create-receipt` Function
- Accept new parameter: `stripe_receipt_url`, `stripe_charge_id`
- Store these in the receipt record

---

## Implementation Flow

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    STRIPE WEBHOOK EVENTS                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  checkout.session.completed (One-time payments)                     │
│  ├── Get receipt_url from charge                                    │
│  ├── Create Invoice with stripe_receipt_url                         │
│  └── Create Receipt with stripe_receipt_url                         │
│                                                                     │
│  invoice.paid (Subscriptions)                                       │
│  ├── Get Stripe invoice URL and receipt URL                         │
│  ├── Create Invoice with stripe_invoice_id, stripe_invoice_url      │
│  ├── Create Receipt with stripe_receipt_url                         │
│  └── Add credits for subscription renewal                           │
│                                                                     │
│  charge.succeeded                                                   │
│  └── Update existing records with receipt_url                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Files to Modify

| File | Changes |
|------|---------|
| Database migration | Add new columns to `invoices` and `receipts` tables |
| `supabase/functions/stripe-webhook/index.ts` | Handle `invoice.paid`, enhance receipt URL capture |
| `supabase/functions/create-invoice/index.ts` | Accept and store Stripe identifiers |
| `supabase/functions/create-receipt/index.ts` | Accept and store Stripe receipt URL |

---

## Technical Details

### New Webhook Event: `invoice.paid`

This handles subscription renewals:

```typescript
case "invoice.paid": {
  const invoice = event.data.object as Stripe.Invoice;
  
  // Skip if not a subscription invoice
  if (!invoice.subscription) break;
  
  // Get user from customer email
  const customer = await stripe.customers.retrieve(invoice.customer);
  const userEmail = customer.email;
  
  // Find user profile
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, email")
    .eq("email", userEmail)
    .single();
  
  if (!profile) break;
  
  // Get subscription credits from metadata
  const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
  const credits = parseInt(subscription.metadata?.credits || "0");
  
  // Create invoice with Stripe URLs
  await fetch(`${SUPABASE_URL}/functions/v1/create-invoice`, {
    body: JSON.stringify({
      user_id: profile.id,
      amount_usd: invoice.amount_paid / 100,
      credits: credits,
      payment_type: 'stripe_subscription',
      payment_id: invoice.id,
      stripe_invoice_id: invoice.id,
      stripe_invoice_url: invoice.hosted_invoice_url,
      stripe_receipt_url: invoice.receipt_url,
      customer_email: userEmail,
      description: `Subscription renewal - ${credits} credits`,
      status: 'paid'
    })
  });
  
  // Create receipt
  await fetch(`${SUPABASE_URL}/functions/v1/create-receipt`, {
    body: JSON.stringify({
      userId: profile.id,
      amountPaid: invoice.amount_paid / 100,
      credits: credits,
      paymentMethod: 'Stripe Subscription',
      stripe_receipt_url: invoice.receipt_url
    })
  });
}
```

### Enhanced `checkout.session.completed` Handler

Add receipt URL capture:

```typescript
// Get receipt URL from payment intent's charge
let receiptUrl: string | null = null;
if (session.payment_intent) {
  const paymentIntent = await stripe.paymentIntents.retrieve(
    session.payment_intent as string,
    { expand: ['latest_charge'] }
  );
  const charge = paymentIntent.latest_charge as Stripe.Charge;
  receiptUrl = charge?.receipt_url || null;
}

// Pass to create-invoice
await fetch(`${SUPABASE_URL}/functions/v1/create-invoice`, {
  body: JSON.stringify({
    // ... existing fields
    stripe_receipt_url: receiptUrl,
    stripe_invoice_url: null, // One-time payments don't have Stripe invoices
  })
});
```

---

## Benefits

1. **Direct Links**: Users can access Stripe's official receipts/invoices
2. **Subscription Support**: Automatic invoice/receipt generation for renewals
3. **Audit Trail**: Stripe IDs stored for reconciliation
4. **Professional Appearance**: Stripe's hosted invoice pages are polished

---

## Migration SQL

```sql
-- Add Stripe columns to invoices
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_invoice_url TEXT,
ADD COLUMN IF NOT EXISTS stripe_receipt_url TEXT;

-- Add Stripe columns to receipts
ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS stripe_receipt_url TEXT,
ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT;

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_invoices_stripe_invoice_id 
ON invoices(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
```
