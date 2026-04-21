

## Hide Service Status from Zero-Credit Customers

Hide the service status pill (header) and offline banner (Dashboard, Upload pages) from customers whose combined credit balance is zero. Staff and admins always see status. Users with any credits (full or similarity) continue to see status normally.

### Rationale

Customers with zero credits cannot upload anyway, so service availability is irrelevant noise for them. Showing it only to credited customers keeps the signal meaningful and reduces clutter for prospects who haven't purchased yet.

### Logic

A customer "has credits" when:
```
(profile.credit_balance > 0) || (profile.similarity_credit_balance > 0)
```

Visibility rule for both Pill and Banner:
- Role is `staff` or `admin` → always show
- Role is `customer` → show only if has credits
- Guest / no profile → hide

### Implementation

**`src/components/ServiceStatusPill.tsx`**
- Pull `role` and `profile` from `useAuth()`.
- Add an early `return null` when role is `customer` and combined credit balance is `0`.
- Keeps existing realtime subscription untouched — only suppresses render.

**`src/components/ServiceStatusBanner.tsx`**
- Same guard at the top of the render (after the existing `if (!state) return null` and `if (status === 'online') return null` checks).
- Applies to Dashboard, UploadDocument, and UploadSimilarity (all three already render this banner).

No other files require changes — the parent pages keep mounting the components; the components self-suppress based on auth state.

### Edge cases

- **Profile still loading**: `profile` is `null` → treat as no credits → hide. Once profile loads, it appears if applicable. No flash of stale state.
- **Credit purchased mid-session**: `useAuth` profile updates → pill/banner re-renders and appears automatically.
- **Credits drop to zero after consumption**: pill/banner disappears on next profile refresh — acceptable, matches the rule.
- **Magic-link guests** on `/g/...`: no `profile`, so already hidden. ✅
- **Staff/admin**: bypass check, always see status (operational need). ✅

### Files touched

```
src/components/ServiceStatusPill.tsx     (add credit-aware visibility guard)
src/components/ServiceStatusBanner.tsx   (add credit-aware visibility guard)
```

