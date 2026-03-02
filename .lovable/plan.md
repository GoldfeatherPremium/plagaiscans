

## Plan: Enhanced Activity Logs Page

### Current State
- Activity Logs page shows document actions and credit transactions from `credit_transactions` table
- Filter only has: All / Document / Credit
- No date range filtering
- No credit type (AI vs Similarity) distinction
- Missing Paddle and manual payment logs
- `credit_transactions` has a `credit_type` field (`full` = AI, `similarity_only` = Similarity)

### Changes to `src/pages/AdminActivityLogs.tsx`

#### 1. Add Credit Type Sub-filter (AI / Similarity)
- Add a second filter dropdown: "All Credits" / "AI Credits" / "Similarity Credits"
- Store `credit_type` in the `ActivityLog` interface as metadata
- Filter credit logs by `credit_type` field (`full` for AI, `similarity_only` for Similarity)

#### 2. Add Paddle & Manual Payment Logs
- Fetch from `paddle_payments` table (status = completed) and map to credit-type logs with source "Paddle"
- Fetch from `manual_payments` table (status = verified) and map to credit-type logs with source "Manual"
- These will appear as `credit` type logs with details showing the payment source

#### 3. Add Date Range Filter
- Add preset buttons: "This Week", "This Month", "Last 30 Days", "All Time"
- Add custom date range picker (start date / end date inputs)
- Filter all logs client-side by date range (data is already fetched)

#### 4. Add Credit Summary Cards at Top
- Replace/expand the stats section to show:
  - **Total AI Credits Added** (sum of `amount` where `credit_type = 'full'` and `transaction_type = 'add'`) within selected date range
  - **Total Similarity Credits Added** (sum where `credit_type = 'similarity_only'` and `transaction_type = 'add'`) within selected date range
  - **Total Transactions** count within date range
- These cards update dynamically based on the active date range filter

#### 5. Updated Filter Options
- Type filter becomes: All / Document / Credit / Paddle Payment / Manual Payment
- Or keep Credit as umbrella and add sub-filters for credit source and credit type

### Data Flow
- All data fetched once on mount (current pattern preserved)
- Date range + type + credit-type + search all applied client-side via `useMemo`
- Credit summary stats computed from filtered data

### Technical Details
- New state variables: `dateRange` (preset or custom), `startDate`, `endDate`, `creditTypeFilter`
- Extend `ActivityLog` interface with optional `credit_type` and `source` fields
- Paddle payments mapped with action like "Paddle Payment: +X credits" and details showing amount
- Manual payments mapped with action like "Manual Payment: +X credits" and details showing payment method

