

## Special Customer Pricing System

### Overview
Add a "special customer" flag to profiles, allow admin to toggle it during pre-registration and user management, create separate pricing packages visible only to special customers, and hide normal pricing from them.

### Database Changes

**1. Add `is_special` column to `profiles`**
```sql
ALTER TABLE public.profiles ADD COLUMN is_special boolean NOT NULL DEFAULT false;
```

**2. Add `is_special` column to `pricing_packages`**
```sql
ALTER TABLE public.pricing_packages ADD COLUMN is_special boolean NOT NULL DEFAULT false;
```

**3. Update RLS on `pricing_packages`**
Replace the "Everyone can view active packages" policy so users only see packages matching their special status:
- Special customers see only `is_special = true` packages
- Normal customers see only `is_special = false` packages
- Non-authenticated users see only `is_special = false` packages

### Frontend Changes

**4. Pre-Registration Dialog (`PreRegisterCreditDialog.tsx`)**
- Add a toggle/switch: "Mark as special customer" (with a star icon, no "special" label — just a `★` indicator)

**5. Edge Function (`create-user-with-credits/index.ts`)**
- Accept `isSpecial` parameter and set `is_special = true` on the created profile

**6. Admin Users Page (`AdminUsers.tsx`)**
- Show a `★` badge next to special customers in the user list
- Add ability to toggle special status (promote/demote) from user detail view

**7. Admin Pricing Page (`AdminPricing.tsx`)**
- Add `is_special` toggle when creating/editing packages (labeled with `★` icon)
- Show a `★` badge on special-only packages to distinguish them

**8. Buy Credits Page (`BuyCredits.tsx`)**
- Filter packages based on user's `is_special` flag from profile
- Special users only see `is_special = true` packages
- Normal users only see `is_special = false` packages

**9. Auth Context (`AuthContext.tsx`)**
- Add `is_special` to the profile type and fetch it alongside other profile data

### UI Approach
- No "special" text anywhere visible to customers
- Use `★` star icon/badge to indicate special status in admin panels
- Special pricing cards get a subtle gold/amber border or highlight so admin can distinguish them, but customers just see normal-looking pricing

### Files Modified
- `supabase/migrations/` — 1 new migration
- `src/contexts/AuthContext.tsx` — add `is_special` to profile
- `src/pages/BuyCredits.tsx` — filter by special status
- `src/pages/AdminPricing.tsx` — add special toggle
- `src/pages/AdminUsers.tsx` — show/toggle special status
- `src/components/PreRegisterCreditDialog.tsx` — add special checkbox
- `supabase/functions/create-user-with-credits/index.ts` — handle `isSpecial`

