

## Add Credit Expiry to All Payment Providers

Currently, only Paddle payments create credit expiry records. All other payment methods (Stripe, NOWPayments/Binance, Dodo, PayPal) add credits without tracking their validity period, meaning those credits never expire.

### What Will Change

After each successful payment, the system will:
1. Look up the purchased package's `validity_days` from the `pricing_packages` table
2. Create a `credit_validity` record with the correct expiration date
3. The existing `expire-credits` background function will automatically expire credits when the date passes

### Payment Functions to Update (6 functions)

1. **stripe-webhook** - After adding credits on `checkout.session.completed`, insert a `credit_validity` record by looking up the package via `stripe_price_id` or credits amount
2. **nowpayments** (Binance/USDT) - After the IPN confirms payment (`finished` status), insert a `credit_validity` record by looking up the package via credits amount
3. **dodo-webhook** - After payment success, insert a `credit_validity` record by looking up the package via `dodo_product_id` or credits amount
4. **paypal-webhook** - After `PAYMENT.CAPTURE.COMPLETED`, insert a `credit_validity` record by looking up the package via credits amount
5. **verify-stripe-payment** - Fallback verification endpoint, add credit_validity after credits are added
6. **verify-paypal-payment** - Fallback verification endpoint, add credit_validity after credits are added

### Implementation Pattern (same for all)

Each function will add a block like this after credits are successfully added:

```text
1. Query pricing_packages to find the matching package
   - Match by provider-specific price ID (e.g., stripe_price_id, dodo_product_id)
   - Fallback: match by credits amount and credit_type
2. Get validity_days from the package (default to 365 if not found)
3. Calculate expires_at = now + validity_days
4. Insert into credit_validity table:
   - user_id, credits_amount, remaining_credits, expires_at, credit_type
```

### No Database Changes Required

The `credit_validity` table and `expire-credits` function already exist and work correctly. This is purely adding the missing credit_validity record creation to 6 edge functions.

### Technical Details

- The Paddle webhook already implements this pattern (lines 275-295 in `paddle-webhook/index.ts`) and will serve as the reference implementation
- Package lookup strategy varies by provider:
  - **Stripe**: Match via session metadata `credits` + `credit_type`, or `stripe_price_id` if available
  - **Dodo**: Match via `dodo_product_id` from metadata
  - **PayPal/NOWPayments**: Match via `credits` amount + `credit_type`
- Default validity of 365 days ensures credits still expire even if no package match is found
- All insertions are wrapped in try/catch so a failure to create the validity record does not block the payment flow

