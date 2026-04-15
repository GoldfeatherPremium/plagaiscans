

## Admin Password Reset for Customers

### Problem
Customers forget passwords. Admins cannot retrieve passwords (they are irreversibly hashed). 

### Solution
Add a "Reset Password" action in the Admin Users page that lets an admin set a new temporary password for a customer and see/copy it to share with them.

### Implementation

**1. Edge Function: `admin-reset-user-password`**
- Accepts `userId` and optionally a custom `newPassword` (or auto-generates a secure random one)
- Uses `supabase.auth.admin.updateUserById()` to set the new password
- Returns the new password so the admin can share it with the customer
- Validates that the caller is an admin via JWT + role check

**2. Admin Users Page Update (`AdminUsers.tsx`)**
- Add a "Reset Password" button/action per user row (or in a user detail dialog)
- On click, opens a dialog showing:
  - Option to auto-generate a strong password or enter a custom one
  - After reset: displays the new password with a "Copy" button
  - Warning: "Share this password securely with the customer. They should change it after logging in."

### Security
- Admin-only access enforced server-side via role check in the edge function
- Password is shown once to the admin, never stored in plaintext

### Files to Create/Edit
- `supabase/functions/admin-reset-user-password/index.ts` — new edge function
- `src/pages/AdminUsers.tsx` — add reset password action
- New component: `src/components/AdminResetPasswordDialog.tsx`

