

# Fix: Credit Expiration Incorrectly Deducting Used Credits

## The Problem

When a customer buys credits with an expiry date, the system tracks them in a `credit_validity` table with a `remaining_credits` field. However, **when credits are actually used (documents scanned), the `remaining_credits` field is never updated**. It stays at the original purchase amount forever.

So when the expiration function runs, it sees the original `remaining_credits` value (e.g., 50) and deducts that from the user's current balance -- even though those credits were already consumed. This effectively steals credits from a newer purchase.

**Example of the bug:**
- Day 1: Buy 50 credits (30-day expiry) -> `remaining_credits = 50`
- Day 1-15: Use all 50 credits -> `remaining_credits` still shows `50` (never updated)
- Day 10: Buy 100 more credits (30-day expiry) -> balance = 100
- Day 30: First batch expires -> system sees 50 "remaining" and deducts 50 from balance -> balance drops to 50 instead of staying at 100

## The Solution

Create a database trigger that automatically decrements `remaining_credits` in `credit_validity` whenever credits are consumed. The trigger fires on credit transaction inserts with negative amounts (usage/deduction) and applies FIFO (First In, First Out) -- consuming from the oldest expiring batch first.

### Step 1: Database Migration

Create a PostgreSQL function + trigger:

- **Function `deduct_credit_validity()`**: Triggered after a credit transaction with a negative amount is inserted. It:
  1. Determines the credit type from the transaction
  2. Finds all active (non-expired, with remaining credits) `credit_validity` records for that user and credit type, ordered by `expires_at` ASC (FIFO)
  3. Loops through batches, decrementing `remaining_credits` until the usage amount is fully accounted for
  4. If a batch reaches 0 remaining, it stays as-is (the expire function will clean it up)

- **Trigger**: `AFTER INSERT ON credit_transactions` when `amount < 0`

### Step 2: Fix the Expire Function

Update `supabase/functions/expire-credits/index.ts` to use the now-accurate `remaining_credits` value. The current logic is actually correct once `remaining_credits` is properly maintained -- it only deducts `remaining_credits` from the user's balance. No changes needed to this function.

### Step 3: Backfill Existing Data

Run a one-time data correction to fix `remaining_credits` for all existing `credit_validity` records based on historical usage. This involves:
- For each user with credit_validity records, calculate total credits used during each batch's validity period
- Update `remaining_credits` accordingly

### Step 4: Handle Edge Cases in the Trigger

- Credits added by admin (positive amounts) should NOT affect `remaining_credits`
- Only usage-type transactions (negative amounts) should trigger the deduction
- If no `credit_validity` records exist for a user (credits without expiry), the trigger does nothing

## Technical Details

```text
credit_transactions INSERT (amount < 0)
           |
           v
  deduct_credit_validity() trigger
           |
           v
  Find oldest non-expired credit_validity
  records for this user + credit_type
           |
           v
  FIFO loop: decrement remaining_credits
  from oldest batch first
           |
           v
  Credits properly tracked per batch
```

### Files to modify:
1. **New migration**: Create `deduct_credit_validity` function and trigger
2. **No edge function changes needed**: The expire-credits function already correctly uses `remaining_credits`

### Risk mitigation:
- The trigger only fires on negative-amount transactions, so purchases and admin additions are unaffected
- FIFO ordering ensures the soonest-expiring credits are consumed first, which is the fairest approach for customers

