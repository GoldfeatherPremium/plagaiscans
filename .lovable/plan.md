
# Full Stripe Integration Enhancement Plan

## Current State Analysis

Your site already has a solid Stripe foundation with:
- Checkout session creation (one-time + subscription)
- Webhook handling with signature verification
- Idempotency protection
- Customer portal access
- Webhook logging
- Payment records and transaction logging

## Enhancement Overview

This plan adds comprehensive security, refunds, disputes, subscription management, and fraud prevention to create a production-grade payment system.

---

## Phase 1: Enhanced Webhook Handler

### Add Missing Event Types

Update `supabase/functions/stripe-webhook/index.ts` to handle:

| Event | Purpose |
|-------|---------|
| `charge.refunded` | Process refunds and deduct credits |
| `charge.dispute.created` | Alert admin of chargebacks |
| `charge.dispute.closed` | Update dispute status |
| `customer.subscription.updated` | Handle plan changes |
| `customer.subscription.deleted` | Handle cancellations |
| `invoice.payment_failed` | Notify user of payment failure |
| `payment_intent.payment_failed` | Track failed payments |

### Database Changes

Create new tables:
- `stripe_refunds` - Track all refunds with credit adjustments
- `stripe_disputes` - Monitor chargebacks and dispute status

```sql
CREATE TABLE stripe_refunds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  payment_intent_id TEXT NOT NULL,
  refund_id TEXT UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL,
  credits_deducted INTEGER DEFAULT 0,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE stripe_disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  charge_id TEXT NOT NULL,
  dispute_id TEXT UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'open',
  evidence_due_by TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
```

---

## Phase 2: Admin Refund Capability

### New Edge Function: `process-stripe-refund`

Allow admins to issue refunds directly:
- Partial or full refunds
- Automatic credit deduction
- Creates transaction record
- Sends user notification

### Frontend Component

Add refund button to `AdminStripePayments.tsx`:
- Dialog to select refund amount
- Reason selection (duplicate, fraudulent, requested_by_customer)
- Preview of credits to be deducted
- Confirmation step

---

## Phase 3: Security Enhancements

### Rate Limiting

Create `supabase/functions/_shared/rate-limiter.ts`:
- Limit checkout creation to 5 per user per hour
- Limit refund requests to 3 per user per day
- Store rate limits in `stripe_rate_limits` table

### Input Validation

Add strict validation to checkout creation:
- Sanitize metadata fields
- Validate amount ranges
- Check user eligibility
- Prevent negative amounts

### Fraud Prevention

Add to checkout session creation:
```typescript
payment_intent_data: {
  capture_method: 'automatic',
  setup_future_usage: null,
  metadata: {
    user_id: user.id,
    ip_address: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent'),
  }
}
```

---

## Phase 4: Subscription Lifecycle Management

### Enhanced Webhook Handling

Handle subscription events:
- **Updated**: Adjust credits if plan changes
- **Deleted**: Remove subscription benefits
- **Trial ending**: Send reminder email
- **Payment failed**: Send notification with retry link

### Auto-Credit on Renewal

When subscription renews:
1. Detect `invoice.paid` event
2. Check if subscription invoice
3. Add monthly credits automatically
4. Send confirmation email

---

## Phase 5: Admin Dashboard Enhancements

### New Admin Page: `AdminStripeDisputes.tsx`

Display all disputes with:
- Dispute status and reason
- Amount at risk
- Evidence deadline
- Quick actions (respond, accept)

### Enhanced `AdminStripePayments.tsx`

Add:
- Refund button per payment
- Payment status badges
- Receipt URL links
- Customer Stripe ID link
- Filter by status (completed, refunded, disputed)

### New Admin Page: `AdminStripeRefunds.tsx`

Track all refunds:
- Original payment reference
- Refund amount and reason
- Credits deducted
- Processing date

---

## Phase 6: Customer Features

### Payment History Enhancement

Update `src/pages/PaymentHistory.tsx`:
- Show refund status
- Display Stripe receipt links
- Download transaction history

### Failed Payment Recovery

New component in dashboard:
- Alert banner for failed payments
- One-click retry via Stripe hosted page
- Link to update payment method

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/process-stripe-refund/index.ts` | Admin refund processing |
| `src/pages/AdminStripeDisputes.tsx` | Dispute management |
| `src/pages/AdminStripeRefunds.tsx` | Refund tracking |
| `src/components/FailedPaymentBanner.tsx` | Payment recovery UI |

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/stripe-webhook/index.ts` | Add refund, dispute, subscription events |
| `supabase/functions/create-stripe-checkout/index.ts` | Add rate limiting, validation, fraud metadata |
| `src/pages/AdminStripePayments.tsx` | Add refund capability, enhanced filtering |
| `src/pages/AdminSettings.tsx` | Add Stripe webhook URL display |
| `src/App.tsx` | Add new admin routes |

---

## Technical Details

### Webhook Event Handler Additions

```typescript
// Refund handling
case "charge.refunded": {
  const charge = event.data.object as Stripe.Charge;
  // Find user from payment records
  // Calculate credits to deduct
  // Update user balance
  // Create refund record
  // Notify user
  break;
}

// Dispute handling
case "charge.dispute.created": {
  const dispute = event.data.object as Stripe.Dispute;
  // Create dispute record
  // Notify admins immediately
  // Flag user account
  break;
}

// Subscription updated
case "customer.subscription.updated": {
  const subscription = event.data.object as Stripe.Subscription;
  // Check if plan changed
  // Adjust credits if needed
  // Update subscription record
  break;
}
```

### Rate Limiter Implementation

```typescript
async function checkRateLimit(userId: string, action: string, limit: number, windowMinutes: number): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
  
  const { count } = await supabase
    .from('stripe_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', windowStart.toISOString());
    
  return (count || 0) < limit;
}
```

---

## Security Checklist

| Feature | Implementation |
|---------|----------------|
| Webhook signature verification | Already in place |
| Idempotency protection | Already in place |
| Rate limiting | New - checkout and refunds |
| Input validation | New - amount and metadata |
| Fraud metadata tracking | New - IP, user agent |
| Admin-only refunds | New - role check required |
| Dispute alerts | New - immediate admin notification |
| Secure error handling | Enhanced - no sensitive data in responses |

---

## Implementation Order

1. **Database migrations** - Create new tables
2. **Webhook enhancements** - Add all event handlers
3. **Rate limiting** - Protect checkout endpoint
4. **Admin refund capability** - Backend + frontend
5. **Dispute monitoring** - New admin page
6. **Customer recovery** - Failed payment UI
7. **Testing** - End-to-end verification

This comprehensive implementation will provide enterprise-grade Stripe integration with full security, refund handling, dispute management, and subscription lifecycle support.
