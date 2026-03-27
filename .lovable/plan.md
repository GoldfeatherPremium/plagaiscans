

## Diagnosis: Credit FIFO Deduction System Is Broken

### Root Cause Found
The database has **zero** `credit_transactions` records with `transaction_type = 'deduction'` (the value used by customer uploads). There are only 42 records with `transaction_type = 'deduct'` (from admin bulk operations).

This means: every time a customer uploads a document, the `credit_transactions` insert **silently fails**. The upload code treats this as "non-critical" and continues. Because no `credit_transactions` row is inserted, the `trg_deduct_credit_validity` trigger **never fires**, so `remaining_credits` in `credit_validity` is **never decremented**.

**Evidence for vnlingoasia@gmail.com:**
- Profile balance: 18 credits (correct)
- Active credit_validity batches show: 30 + 10 + 50 = 90 remaining (should be 18 total)
- 116 documents uploaded, zero deduction transaction records
- When batches expire, the system sees remaining_credits > 0 and incorrectly deducts from the profile balance again

### Fix Plan

#### 1. Database Function: `consume_user_credit`
Create a SECURITY DEFINER database function that performs the entire credit consumption atomically in a single server-side transaction:
- Check and deduct from `profiles.credit_balance` (or `similarity_credit_balance`)
- Insert into `credit_transactions`
- FIFO deduct from `credit_validity.remaining_credits` (oldest expiry first)

This eliminates the multi-step client-side approach that silently fails.

#### 2. Update Upload Hooks
Modify `useDocuments.ts` (AI scan uploads) and `useSimilarityDocuments.ts` (similarity uploads) to call `supabase.rpc('consume_user_credit', ...)` instead of doing 3 separate client-side operations (profile update + transaction insert + trigger).

#### 3. Reconcile Existing Data
Run a one-time migration to fix all `credit_validity.remaining_credits` values. For each user:
- Sum actual documents uploaded (credits consumed)
- Apply FIFO logic retroactively to update `remaining_credits` in each batch
- Ensure sum of `remaining_credits` across active batches = profile's current balance

#### 4. Simplify expire-credits Function
Since `remaining_credits` will now be accurate, the expire-credits function can simply use `remaining_credits` directly without the complex reconciliation logic.

### Technical Details

**New database function signature:**
```sql
CREATE OR REPLACE FUNCTION public.consume_user_credit(
  p_user_id uuid,
  p_credit_type text DEFAULT 'full',
  p_description text DEFAULT 'Credit used'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
```

**Upload hook change (both hooks):**
```typescript
// Replace 3 separate calls with one atomic RPC
const { data, error } = await supabase.rpc('consume_user_credit', {
  p_user_id: user.id,
  p_credit_type: 'full',
  p_description: `Document upload: ${file.name}`
});
```

**Files to modify:**
- New migration: create `consume_user_credit` function + reconcile existing data
- `src/hooks/useDocuments.ts` - replace manual balance deduction with RPC call
- `src/hooks/useSimilarityDocuments.ts` - replace manual balance deduction with RPC call
- `supabase/functions/expire-credits/index.ts` - simplify to trust remaining_credits directly

