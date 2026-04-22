
## Rebuild the checkout summary from scratch using Paddle as the source of truth

### 1. Replace the current VAT summary logic with a clean Paddle summary model
In `src/pages/Checkout.tsx`, remove the current ad-hoc summary/VAT wiring built around `paddleTotals` and rebuild it as a dedicated summary state for the inline card checkout.

New state shape:
```ts
type PaddleSummary = {
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  hasTax: boolean;
  taxRate: number | null;
  sourceEvent: string | null;
}
```

Rules:
- Reset this summary whenever package, quantity, or promo changes and the Paddle checkout remounts.
- Do not calculate VAT manually from local package prices.
- Do not keep the old fallback heuristics, recursive scans, or mixed local/Paddle tax math.

### 2. Initialize Paddle with a real `eventCallback`
Move the summary update logic into `Paddle.Initialize({ token, eventCallback })` so it listens globally to Paddle checkout events, instead of relying on temporary per-open parsing only.

Listen to:
- `checkout.loaded`
- `checkout.updated`
- `checkout.customer.updated`

For each of those events:
- read `event.data?.totals?.subtotal`
- read `event.data?.totals?.tax`
- read `event.data?.totals?.total`
- read `event.data?.currency_code`

Normalization:
- convert strings/numbers safely
- support amounts that may arrive as cents by normalizing before display
- prefer Paddle-provided totals only

Update the summary only when Paddle sends a valid totals object.

### 3. Build a single “official checkout summary” renderer
Replace the current mixed summary rows with a clean render flow:

#### Before Paddle totals arrive
Show local estimated pricing only:
- Credits
- Estimated subtotal
- Discount row if promo exists
- Estimated total

No VAT row yet.

#### After Paddle totals arrive
Swap to Paddle’s official values:
- Credits
- Subtotal
- VAT / Tax (only if `tax > 0`)
- Total
- Small helper text like: “Calculated by Paddle based on billing location”

This makes the UI mirror the exact amount shown on Paddle’s pay button.

### 4. Compute VAT percentage only from Paddle totals
Keep the percentage label, but derive it only from:
```ts
taxRate = subtotal > 0 && tax > 0 ? (tax / subtotal) * 100 : null
```

Display:
- `VAT / Tax`
- `VAT / Tax (15.00%)` when available

No inferred percentage from local package math.

### 5. Avoid stale or disappearing tax values
When Paddle emits an eligible event:
- replace the whole summary from that event
- do not merge with old tax guesses
- do not preserve old VAT if a new event returns a full totals object with different numbers

This gives a deterministic “latest official Paddle totals wins” flow.

### 6. Keep the desktop split untouched
The current desktop structure in `src/pages/Checkout.tsx` already renders:
- Order Summary on the left
- Payment Method on the right

Keep that layout as-is while rebuilding only the summary data source.

### 7. Keep the USDT UI separate from Paddle summary logic
Do not mix the USDT alternative with the Paddle VAT logic.

If needed during implementation:
- keep the green “Pay via USDT” pill styling
- keep its current routing behavior
- ensure the summary rebuild only affects the Paddle/card checkout path

### 8. Files to update
```text
src/pages/Checkout.tsx
  - remove the current VAT fallback summary wiring
  - add a clean Paddle summary state
  - attach a fresh Paddle Initialize eventCallback
  - rebuild the Order Summary rendering to use Paddle totals when available
```

### Technical details
```text
Data flow:

Package / quantity / promo selected
        ↓
Create Paddle transaction
        ↓
Open inline Paddle checkout
        ↓
Paddle eventCallback receives:
  checkout.loaded / checkout.updated / checkout.customer.updated
        ↓
Read event.data.totals.{subtotal,tax,total}
        ↓
Normalize values
        ↓
setPaddleSummary(...)
        ↓
Order Summary re-renders from Paddle totals
```

### Expected outcome
- When the customer selects their country and Paddle adds VAT, the Order Summary updates automatically.
- The summary total matches Paddle’s green pay button.
- VAT is shown only when Paddle actually returns tax.
- Old custom VAT logic is removed completely instead of patched again.
