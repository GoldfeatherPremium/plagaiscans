

## Add Expired Credits Summary with Time Frame Filtering

### Goal
Add a new stats section to both the **Credit Validity Management** page and the **Magic Upload Links** page showing how many unused credits have expired, with the ability to filter by time frame (e.g., last 7 days, 30 days, 90 days, all time).

### Current State
- The Credit Validity page shows 4 stat cards: Total Records, Active, Expiring Soon, Expired (count only)
- The Magic Links page has no credit expiration info at all
- The `credit_validity` table tracks expired records (`expired = true`) with `credits_amount` (original allocation)
- When credits expire, `remaining_credits` is set to 0, so we cannot retroactively determine exactly how many were unused at the moment of expiry

### Data Limitation & Fix
Currently, the expire logic zeros out `remaining_credits` without preserving how many were wasted. To accurately track expired (wasted) credits going forward:

1. **Add a `credits_expired_unused` column** to the `credit_validity` table -- stores the remaining credits at the moment of expiration (before zeroing)
2. **Update the `expire-credits` edge function** to populate this column when processing expirations
3. **Update the manual "Mark Expired" action** on the admin page to also record unused credits before zeroing

### Changes

#### 1. Database Migration
- Add `credits_expired_unused INTEGER DEFAULT NULL` column to `credit_validity`
- For existing expired records, set `credits_expired_unused = credits_amount` as a best-effort approximation (since the actual unused count is lost)

#### 2. Update `expire-credits` Edge Function
- Before setting `remaining_credits = 0`, save the value into `credits_expired_unused`

#### 3. Update `AdminCreditValidity.tsx`
- Add a **time frame selector** (Period: 7d / 30d / 90d / All Time) near the stats area
- Add a new stat card: **"Total Expired Credits"** showing the sum of `credits_expired_unused` (or `credits_amount` for older records) filtered by the selected time frame
- Split into **AI Scan Expired** and **Similarity Expired** sub-stats
- The existing 4 stat cards remain; this adds a highlighted summary card below them

#### 4. Update `AdminMagicLinks.tsx`
- Add a compact **"Expired Credits Summary"** card at the top (alongside existing stats) querying the same `credit_validity` data
- Include a simple period selector (7d / 30d / 90d / All Time)
- Show total expired credits count and amount, broken down by type

#### 5. Shared Query Hook (optional optimization)
- Create a reusable query or inline the fetch in both pages to get expired credit stats filtered by date range

### Technical Details

**New column migration:**
```sql
ALTER TABLE credit_validity 
ADD COLUMN credits_expired_unused INTEGER DEFAULT NULL;

UPDATE credit_validity 
SET credits_expired_unused = credits_amount 
WHERE expired = true;
```

**Period filter logic:**
- Filter `credit_validity` records where `expired = true` and `expires_at` falls within the selected period
- Sum `credits_expired_unused` grouped by `credit_type`

**Stats displayed:**
- Total expired credit batches (count)
- Total wasted AI Scan credits
- Total wasted Similarity credits
- Period comparison (e.g., "58 batches / 1,003 credits expired all time")

