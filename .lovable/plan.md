

# Conditional Dashboard Sections Based on Credit Type

## Problem
The AI Scan Queue section always shows for all customers, even those with zero AI credits. Only the Similarity Queue already has credit-based visibility. This means a similarity-only customer sees an empty AI Scan section.

## Solution
Update the visibility conditions in `src/pages/Dashboard.tsx` so that for **customers**:

- **AI Scan Queue section** (line 181): Only show when `profile.credit_balance > 0`
- **Similarity Queue section** (line 270): Already conditional -- no change needed

This means:
1. **AI credits only** -- only AI Scan Queue shown
2. **Similarity credits only** -- only Similarity Queue shown
3. **Both credits** -- both sections shown
4. **No credits** -- neither section shown (edge case)

Staff and admin visibility remains unchanged.

## Technical Details

### File: `src/pages/Dashboard.tsx`

**Line 181** -- Change the customer condition from always-true to credit-based:

```
// Before:
(role === 'customer' || role === 'admin' || (role === 'staff' && canAccessAI))

// After:
((role === 'customer' && (profile?.credit_balance || 0) > 0) || role === 'admin' || (role === 'staff' && canAccessAI))
```

The similarity section at line 270 already has this logic, so no changes needed there.

This is a one-line change -- minimal risk, clean fix.

