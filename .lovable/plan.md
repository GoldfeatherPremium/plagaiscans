

## Improve VAT detection + unify USDT into one highlighted button

### 1. Robust VAT/Tax fallback in Paddle event handler

Update the `eventCallback` in `src/pages/Checkout.tsx` so it picks up tax from any payload shape Paddle emits — not just the root `data.totals`. Paddle returns pricing in slightly different keys depending on the event (`checkout.loaded`, `checkout.updated`, `checkout.items.updated`, `checkout.customer.updated`), and tax sometimes only appears on `recurring_totals`, on individual items, or under camelCase keys.

New extraction logic checks (in order, first hit wins for each field):

```text
subtotal:  data.totals.subtotal
        |  data.totals.sub_total
        |  data.totals.subTotal
        |  data.recurring_totals.subtotal
        |  sum(data.items[].totals.subtotal)
        |  data.totals.balance        (when subtotal absent but balance present)

tax:       data.totals.tax
        |  data.totals.tax_total
        |  data.recurring_totals.tax
        |  sum(data.items[].totals.tax)

total:     data.totals.total
        |  data.totals.grand_total
        |  data.totals.grandTotal
        |  data.recurring_totals.total
        |  sum(data.items[].totals.total)
        |  subtotal + tax            (computed fallback)

currency:  data.currency_code | data.currencyCode | items[0].price.currency_code | 'USD'
```

Behavior changes:
- Update `paddleTotals` whenever **any one** of {subtotal, tax, total} is > 0 (currently requires the parent `totals` object to exist, which is why early events with only item-level totals are missed).
- Keep tax updating live as the customer types country / postcode — never overwrite a known tax with 0 (only overwrite when the new event also carries tax fields, to avoid flicker).
- Order Summary already conditionally renders the VAT line on `paddleTotals.tax > 0`, so once the extraction works the row appears automatically.

### 2. Single highlighted "Pay via USDT" button

Replace **both** USDT bullets (NowPayments auto + Manual TRC20) with **one** prominent green pill button below the Paddle frame:

```text
┌───────────────────────────────────────────────┐
│ [Paddle inline card form]                     │
└───────────────────────────────────────────────┘

      ┌─────────────────────────────────┐
      │  ●  Pay via USDT                │   ← solid green, white text, rounded
      └─────────────────────────────────┘
```

Styling: `bg-green-600 hover:bg-green-700 text-white font-medium rounded-full px-5 py-2.5 inline-flex items-center gap-2 shadow-sm` with a small white bullet dot icon. Centered under the card form with a bit of top spacing.

### 3. Click behavior — choose path automatically

When clicked, route the user based on what the admin has enabled (no second picker shown to the user; the label stays "Pay via USDT"):

| `usdtEnabled` (NowPayments auto) | `usdtManualEnabled` (manual TRC20) | Click action |
|---|---|---|
| ✅ | ❌ | Open NowPayments inline section (existing `setShowUsdtSection(true)` → `createCryptoPayment`) |
| ❌ | ✅ | Open manual transfer dialog (existing `openUsdtManualDialog`) |
| ✅ | ✅ | Prefer **NowPayments auto** (faster, no admin wait); manual stays available only if auto fails |
| ❌ | ❌ | Button hidden entirely |

The fallback "No payment methods available" condition stays the same logical check.

### 4. Files touched

```text
src/pages/Checkout.tsx
  • Rewrite eventCallback totals-extraction with fallback chain (~25 lines)
  • Replace the two separate USDT bullet blocks (lines ~1042–1102) with one
    green highlighted "Pay via USDT" button + smart-routing onClick
  • Keep createCryptoPayment, openUsdtManualDialog, dialogs, NowPayments
    expansion panel — no logic change underneath
```

No backend / edge-function changes. No new dependencies. No DB changes.

