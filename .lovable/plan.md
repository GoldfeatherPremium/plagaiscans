

## Fix: Deleted Documents Reappearing for Customers

### Root Cause

In `src/hooks/useDocuments.ts`, the realtime subscription (line 760-782) captures a stale reference to `fetchDocuments`. The subscription effect depends only on `[user]`, but `fetchDocuments` uses `role` from closure scope. When the realtime event fires, it may call `fetchDocuments` with a stale or undefined `role`, causing the `deleted_by_user` filter (line 87-88) to be skipped — since the filter only applies when `role === 'customer'`.

Additionally, even when `role` is correct, the filter is only applied for customers. A more robust fix is to **always** filter out `deleted_by_user = true` documents for customers, regardless of how `fetchDocuments` is invoked.

### Fix (1 file)

**`src/hooks/useDocuments.ts`** — Two changes:

1. **Always filter out soft-deleted documents for customers**: Move the `deleted_by_user` filter to apply unconditionally for customer role, and also apply it as a safety net even if role is ambiguous by checking if the user has no staff/admin role.

2. **Fix stale closure in realtime subscription**: Add `role` to the realtime effect's dependency array so the subscription re-creates with current `fetchDocuments` when role changes. Alternatively, use a ref to always call the latest `fetchDocuments`.

```typescript
// Line 760-782: Add role to deps
useEffect(() => {
  if (!user) return;

  const channel = supabase
    .channel('documents-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'documents',
      },
      () => {
        fetchDocuments(true); // background fetch to avoid loading flash
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user, role]); // Add role to dependencies
```

And change the realtime handler to call `fetchDocuments(true)` (background mode) to prevent UI flicker.

### What this fixes
- Documents soft-deleted by customers will stay hidden even when realtime events fire
- No more stale closure causing the filter to be bypassed
- Background fetch prevents loading spinner flash on every realtime event

