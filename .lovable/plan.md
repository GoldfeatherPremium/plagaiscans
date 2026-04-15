

## Fix: Guest Documents Leaking Into Customer Accounts

### Root Cause
Two issues combine to cause this bug:

1. **Missing role assignment**: User `mhhashim471@gmail.com` has no entry in `user_roles`, so their role resolves to `null`.
2. **Incomplete filter logic**: In `useDocuments.ts`, the `user_id` filter only applies when `role === 'customer'`. When role is `null`, no user filter is applied, and the RLS policy "Anyone can view documents via active magic link" returns all guest documents.

### Fix Plan

**1. Fix the filter logic in `useDocuments.ts` (line ~87)**
Change the condition from:
```typescript
if (role === 'customer') {
```
to:
```typescript
if (role !== 'staff' && role !== 'admin') {
```
This ensures that any non-staff/non-admin user (including those with `null` role) only sees their own documents. This is the defensive, correct approach — only explicitly privileged roles should see all documents.

**2. Assign the missing role for this user**
Run a database migration to insert the `customer` role for user `mhhashim471@gmail.com` so their account works correctly going forward.

### Files to Modify
- `src/hooks/useDocuments.ts` — line 87: change role check condition
- Database: insert missing `user_roles` record for user `25b6bb00-ce4e-4b52-93c3-035108e410cf`

