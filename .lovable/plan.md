

## Plan: Remove Tabs from Payment History — Show Unified List

### Problem
The Payment History page (`src/pages/PaymentHistory.tsx`) splits Paddle and Binance payments into two separate tabs. The user wants all payments shown directly in a single view without tabs.

### Changes

**`src/pages/PaymentHistory.tsx`** — single file change:

1. Remove the `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` imports and wrapper
2. Merge both payment lists into one unified table, sorted by date (newest first)
3. Combine Paddle and manual payments into a single array with a normalized shape (adding a `source` field like "Paddle" or "Binance")
4. Show one table with columns: Date, Method, Credits, Amount, Status, Receipt
5. The "Method" column shows a badge indicating Paddle or Binance
6. Keep all existing functionality (receipt download, status badges, realtime subscriptions)

### What stays the same
- Stats cards at the top remain unchanged
- Realtime subscriptions for both tables remain
- Receipt download logic unchanged
- All status badge rendering unchanged

