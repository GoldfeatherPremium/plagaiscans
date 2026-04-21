

## Add Quantity Selector to Checkout — Auto-syncs With All Payment Methods

Currently `/dashboard/checkout?packageId=…` locks the customer to exactly 1 unit of the selected package. I'll add a quantity stepper that recomputes credits + amount everywhere on the page and passes the multiplied values to every payment provider so the right number of credits land in the customer's account on success.

### 1. Quantity stepper on Checkout
File: `src/pages/Checkout.tsx`

- Add `const [quantity, setQuantity] = useState(1);` (clamped 1–99).
- Replace the static "Order Summary" package block with a `−  [qty]  +` stepper plus a small numeric input. Show `quantity × packageCredits` credits and `quantity × packagePrice` subtotal.
- Add two derived values used everywhere downstream:
  - `totalCredits = packageCredits * quantity`
  - `totalPrice = packagePrice * quantity`
- Update `calculateTotalWithFee()` and the promo discount math to use `totalPrice` (not `packagePrice`) so fees, discounts, and the "Total" line all reflect the chosen quantity.

### 2. Pass quantity through to every payment method
All amounts go to cents via `Math.round(... * 100)` exactly as today — only the base price changes.

| Method | Change in `Checkout.tsx` | Change in edge function |
|---|---|---|
| **Paddle** | Send `quantity` in invoke body | `create-paddle-checkout/index.ts`: use `quantity` in `items[0].quantity` (today hard-coded to 1); `custom_data.credits` stays the per-unit base. The existing `paddle-webhook` already does `baseCredits * itemQuantity`, so credits land correctly. |
| **Binance Pay** (manual) | Multiply `credits` and `amount_usd` by quantity in the `manual_payments` insert; include qty in admin notification text | None — admin verification flow already reads stored `credits`. |
| **USDT (NowPayments)** | Send `credits: totalCredits, amountUsd: totalWithFee` (already total-based) | None — `nowpayments` already credits whatever `credits` value it received. |
| **USDT manual** | Multiply `credits` and `amount_usd` in `manual_payments` insert | None. |
| **Stripe (embedded)** | Pass `credits: totalCredits, amount: totalCents` to `create-stripe-embedded-checkout` (already does, just via new totals) | None — webhook trusts the metadata it set. |
| **Dodo** | Pass multiplied `credits`/`amount`; bump `cartItems[0].quantity` | None. |
| **PayPal** | Pass multiplied `credits`/`amount` | None. |
| **WhatsApp / Bank Transfer** | Include quantity + total in the prefilled message | N/A (manual). |

No webhook signature logic, no DB schema, and no other pages change.

### 3. Out of scope
- BuyCredits / Pricing pages (quantity is chosen at checkout, not on the catalog).
- Subscriptions, refunds, promo bonus credit logic (still per-package as today).
- Paddle subscription `subscription.created` flow (one-time purchase only).

### Verification
After build, on `/dashboard/checkout?packageId=…`:
- Stepper renders next to the package name; "+/−" updates Credits, Subtotal, Discount, and Total live.
- Total per method updates with fees applied to the new subtotal.
- For Paddle test purchase of qty 3 of a 5-credit pack → 15 credits added in `profiles.credit_balance` after webhook.
- For Binance Pay submission of qty 2 → admin sees `manual_payments` row with `credits = 2 × pack` and matching `amount_usd`; on admin verify, that many credits land.
- For USDT (NowPayments) qty 2 → `nowpayments` callback adds the multiplied credits on payment confirmation.

