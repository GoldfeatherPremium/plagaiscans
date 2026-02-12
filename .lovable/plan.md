
# Paddle Checkout Integration Plan

## Overview
Integrate Paddle as a payment processor alongside existing payment methods (Stripe, PayPal, Viva, USDT, Binance, Dodo). Your legal pages already reference Paddle as the Merchant of Record -- this plan adds the actual checkout functionality.

## Prerequisites -- Secrets Needed
Before implementation, you'll need to provide:
- **PADDLE_API_KEY** -- Your Paddle API key (from Paddle dashboard > Developer Tools > Authentication)
- **PADDLE_WEBHOOK_SECRET** -- For verifying webhook signatures (from Paddle dashboard > Developer Tools > Notifications)
- **PADDLE_CLIENT_TOKEN** -- Client-side token for Paddle.js (from Paddle dashboard > Developer Tools > Authentication)
- **PADDLE_ENVIRONMENT** -- "sandbox" or "production"

## Implementation Steps

### Step 1: Database Schema
Create new tables and update settings for Paddle:

- **paddle_payments** -- Track Paddle transactions
  - id, user_id, transaction_id, paddle_customer_id, amount_usd, credits, credit_type, status, customer_email, receipt_url, completed_at, created_at
- **paddle_subscriptions** -- Track Paddle subscriptions
  - id, user_id, subscription_id, paddle_customer_id, product_id, price_id, status, current_period_start, current_period_end, canceled_at, created_at, updated_at
- **paddle_webhook_logs** -- Store raw webhook events for debugging
  - id, event_id (unique), event_type, payload, processed, error_message, created_at

All tables will have RLS enabled with appropriate policies (users see their own records, admins see all).

Add new settings keys: `payment_paddle_enabled`, `fee_paddle`, `paddle_environment`.

Add `paddle_price_id` column to **pricing_packages** table for mapping packages to Paddle price IDs.

### Step 2: Backend Edge Functions

**create-paddle-checkout** (new edge function)
- Accepts: user auth token, credits, amount, credit_type, price_id
- Creates a Paddle transaction using the Paddle API
- Returns a transaction ID for the client-side overlay checkout
- Includes rate limiting and input validation (same pattern as existing Stripe checkout)

**paddle-webhook** (new edge function)
- Receives Paddle webhook events
- Verifies webhook signature using PADDLE_WEBHOOK_SECRET
- Handles these event types:
  - `transaction.completed` -- Add credits, create invoice/receipt, notify user
  - `subscription.created` -- Record subscription
  - `subscription.updated` -- Update subscription status
  - `subscription.canceled` -- Mark subscription canceled
  - `transaction.payment_failed` -- Notify user of failure
- Uses idempotency keys (same pattern as Stripe webhook) to prevent duplicate credit additions
- Logs all events to paddle_webhook_logs

### Step 3: Frontend -- Checkout Page Update
Update `src/pages/Checkout.tsx`:
- Add Paddle as a payment method option (alongside Stripe, PayPal, etc.)
- Load Paddle.js SDK via script tag when Paddle is enabled
- Initialize Paddle with client token and environment setting
- When user clicks "Pay with Paddle":
  1. Call `create-paddle-checkout` edge function to get transaction details
  2. Open Paddle checkout overlay using `Paddle.Checkout.open()`
  3. Handle success/close callbacks
- Read `payment_paddle_enabled` and `fee_paddle` from settings (already fetched in the existing settings query)

### Step 4: Frontend -- Admin Settings Update
Update `src/pages/AdminSettings.tsx`:
- Add Paddle toggle (enable/disable) in payment settings section
- Add Paddle fee percentage input
- Add Paddle environment selector (Sandbox/Production)
- Add fields for Paddle Client Token (stored in settings table, not secrets -- it's a publishable client-side token)

### Step 5: Frontend -- BuyCredits Subscription Support
Update `src/pages/BuyCredits.tsx`:
- When Paddle is enabled and a package has a `paddle_price_id`, use Paddle for subscription checkout
- The overlay checkout handles subscription creation automatically

### Step 6: Frontend -- Subscription Management
Update `src/pages/SubscriptionManagement.tsx`:
- Show Paddle subscriptions alongside Stripe subscriptions
- Add "Cancel Subscription" button that calls Paddle API via edge function
- Display billing history from paddle_payments table

### Step 7: Admin Pricing Page
Update `src/pages/AdminPricing.tsx`:
- Add `paddle_price_id` field when creating/editing pricing packages
- This maps each package to a Paddle price for checkout

### Step 8: Config Updates
- Add `[functions.create-paddle-checkout]` and `[functions.paddle-webhook]` entries to `supabase/config.toml` with `verify_jwt = false`

## Technical Details

### Paddle.js Integration (Client-Side)
```text
1. Script loaded dynamically: https://cdn.paddle.com/paddle/v2/paddle.js
2. Initialized with: Paddle.Environment.set("sandbox" or "production")
3. Paddle.Setup({ token: clientToken })
4. Checkout opened with: Paddle.Checkout.open({ transactionId })
```

### Webhook Flow
```text
Paddle Server --> paddle-webhook edge function
  --> Verify signature (using H-Signature header + PADDLE_WEBHOOK_SECRET)
  --> Parse event type
  --> Check idempotency (payment_idempotency_keys table)
  --> Add credits to user profile
  --> Log transaction in paddle_payments
  --> Create invoice + receipt
  --> Send notification to user
```

### Payment Method Selection (Checkout Page)
```text
Existing methods: Stripe | PayPal | Viva | USDT | Binance | WhatsApp | Dodo
New addition:     Paddle (card icon, shows overlay checkout)
```

### Security
- Webhook signature verification using Paddle's notification secret
- Idempotency keys prevent duplicate credit additions
- Rate limiting on checkout creation (same 5/hour pattern as Stripe)
- Input validation with sanitized parameters
- RLS policies on all new tables

## Files to Create
- `supabase/functions/create-paddle-checkout/index.ts`
- `supabase/functions/paddle-webhook/index.ts`

## Files to Modify
- `supabase/config.toml` -- Add function entries
- `src/pages/Checkout.tsx` -- Add Paddle payment option
- `src/pages/AdminSettings.tsx` -- Add Paddle configuration
- `src/pages/AdminPricing.tsx` -- Add paddle_price_id field
- `src/pages/BuyCredits.tsx` -- Paddle subscription support
- `src/pages/SubscriptionManagement.tsx` -- Show Paddle subscriptions
- `src/pages/Index.tsx` -- Update FAQ payment methods mention
- Database migration for new tables and columns

## Important Notes
- Paddle acts as MoR, so it handles VAT/tax automatically -- no extra tax logic needed on your side
- Paddle supports trials, coupons, and multi-currency natively
- The existing `pricing_packages` table will gain a `paddle_price_id` column so admins can map packages to both Stripe and Paddle prices
