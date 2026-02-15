
# Smart Upload Routing Based on Credit Type

## Problem
The dashboard always shows "Upload (AI Scan)" as the quick action card, even when a customer only has similarity credits. This is confusing.

## Solution
Replace the static "Upload (AI Scan)" card with smart routing logic:

1. **AI credits only** -- clicking "Upload Documents" goes directly to `/dashboard/upload` (AI scan)
2. **Similarity credits only** -- clicking "Upload Documents" goes directly to `/dashboard/upload-similarity`
3. **Both credits** -- clicking "Upload Documents" opens a dialog asking which scan type to use
4. **No credits** -- show the card linking to buy credits (or keep current behavior)

## Changes

### 1. Dashboard.tsx (Quick Actions section, lines 396-431)
- Replace the hardcoded `<Link to="/dashboard/upload">` with dynamic logic
- When both credit types exist, show a dialog (using existing Radix Dialog component) with two options:
  - "AI Scan" -- navigates to `/dashboard/upload`
  - "Similarity Scan" -- navigates to `/dashboard/upload-similarity`
- When only one type exists, link directly to the appropriate upload page
- Update the card label dynamically: show "Upload (AI Scan)" or "Upload (Similarity Scan)" when only one type, or generic "Upload Documents" when both

### 2. Dialog for dual-credit users
- Simple modal with two styled option cards
- Each card shows the scan type name, a brief description, and available credit count
- Clicking either card navigates to the respective upload page and closes the dialog

## Technical Details

- Add `useState` for dialog open state in Dashboard component
- Use the existing `Dialog` component from `@/components/ui/dialog`
- Read `profile.credit_balance` and `profile.similarity_credit_balance` to determine routing
- No new files needed -- all changes are within `src/pages/Dashboard.tsx`
- The sidebar already handles this correctly (lines 291-319 in DashboardSidebar.tsx), so no sidebar changes needed
