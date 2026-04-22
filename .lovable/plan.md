

## Make Paddle Inline Card Checkout the Default

When a customer hits **Buy Now**, the checkout page will render the **Paddle inline card form directly inside the page** — card number, expiry, CVC, country, plus Paddle-supported alternatives (Google Pay, Apple Pay, etc.) — with no method-picker step and no popup window. Below the card form, a single small bullet button offers **USDT** as the alternative.

### What changes

**1. Inline Paddle checkout (always visible by default)**

The right-hand checkout panel renders Paddle's inline checkout iframe directly on the page. As soon as the package + quantity are known, `Paddle.Checkout.open({ transactionId, settings: { displayMode: 'inline', frameTarget: 'paddle-inline-frame', frameInitialHeight: 450, frameStyle: 'width:100%; min-width:312px; background-color: transparent; border: none;' } })` is called, mounting the form into a `<div class="paddle-inline-frame">` container.

```text
┌──────────────────────────────────────────────┬──────────────────────┐
│  Pay securely                                │  Order Summary       │
│  ┌──────────────────────────────────────┐    │  • 10 Credits ×1     │
│  │ [Paddle inline iframe]               │    │  • Promo code        │
│  │  Card number, MM/YY, CVC, Country    │    │  • Total: $39.90     │
│  │  Google Pay / Apple Pay buttons      │    │                      │
│  │  [ Pay $39.90 ]                      │    │                      │
│  └──────────────────────────────────────┘    │                      │
│                                              │                      │
│  • Pay with USDT (TRC20) instead             │                      │
└──────────────────────────────────────────────┴──────────────────────┘
```

**2. USDT as a single bullet button below**

Directly under the inline card form, a compact text button:
- `• Pay with USDT (TRC20) instead`

Clicking it expands the existing USDT NowPayments flow (address + QR + status polling) inline below — same `createCryptoPayment` handler and `paymentDetails` dialog that already exist. No change to USDT logic.

**3. Quantity / promo updates re-mount the Paddle frame**

Paddle's transaction locks the amount at creation time, so the inline frame is keyed on `quantity + appliedPromo + packageId`. When either changes, the previous transaction is closed (`Paddle.Checkout.close()`) and a new transaction is created and remounted automatically.

**4. Other payment methods removed from primary flow**

Stripe, PayPal, Dodo, Viva, Binance Pay, Bank Transfer, WhatsApp, Manual USDT cards are removed from the checkout page surface. Only **Paddle inline (card + Google/Apple Pay)** + **USDT** remain visible. The settings (`payment_stripe_enabled`, etc.) and their backend flows stay intact for future use, but they no longer render on `/dashboard/checkout`.

**5. Fallback**

If `payment_paddle_enabled = false` OR `paddle_client_token` is empty OR the package has no `paddle_price_id` configured: the inline form area shows a clear "Card payments are temporarily unavailable" message and the USDT bullet button auto-promotes to a primary button. (USDT-only fallback so customers can still pay.)

**6. Special-customer overrides**

If a ★ Special customer has Paddle disabled in `special_payment_paddle_enabled`, same fallback as above (USDT-only).

### Edge cases

| Case | Behavior |
|------|----------|
| Quantity / promo changed mid-session | Frame closes, new transaction created, frame remounts. Card details typed are cleared (Paddle limitation). |
| Package missing `paddle_price_id` | Show "Card payments unavailable for this package" + USDT primary fallback. |
| Paddle.js fails to load | Loading spinner for ~5s, then fallback message + USDT primary. |
| Successful payment | Paddle's `eventCallback` fires `checkout.completed` → redirect to `/dashboard/payment-success?provider=paddle` (existing flow). |
| User wants USDT | Click the bullet → existing NowPayments dialog with address, amount, QR, status check. |

### Backend

No edge-function changes. `create-paddle-checkout` already returns `transactionId` correctly. `nowpayments` USDT flow is unchanged.

### Files touched

```text
src/pages/Checkout.tsx              replace payment-methods section with inline Paddle frame + USDT bullet
                                    add Paddle.Checkout.open({ displayMode: 'inline', frameTarget }) on mount
                                    add re-mount effect keyed on quantity/promo/packageId
                                    remove rendering of stripe/dodo/paypal/viva/binance/bank-transfer/whatsapp/usdt-manual blocks
                                    keep handler functions for now (dead code) to avoid touching unrelated flows
```

