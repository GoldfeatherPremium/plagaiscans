

## Special Pricing for Guest Upload Links

### What This Does
When an admin creates a guest upload link, they can mark it as "★" (special). Guests using that link will see special pricing packages instead of normal ones — both on the guest upload page and if they later sign up.

### Database Changes

**1. Add `is_special` column to `magic_upload_links`**
```sql
ALTER TABLE public.magic_upload_links ADD COLUMN is_special boolean NOT NULL DEFAULT false;
```

### Code Changes

**2. `src/hooks/useMagicLinks.ts`**
- Update `MagicUploadLink` interface to include `is_special`
- Update `createMagicLink` to accept and pass `isSpecial` parameter

**3. `src/pages/AdminMagicLinks.tsx`**
- Add a ★ toggle in the create dialog
- Show ★ badge on special links in the table
- Pass `isSpecial` to `createMagicLink`

**4. `src/pages/GuestUpload.tsx`**
- Read `linkData.is_special` from the validated magic link
- Filter pricing packages: if `is_special` is true, fetch only `is_special = true` packages; otherwise fetch only `is_special = false` packages
- Since guests are unauthenticated and RLS blocks them from special packages, use a direct filter: `.eq('is_special', linkData.is_special)`

**5. RLS Policy Update**
- Update the anonymous/public SELECT policy on `pricing_packages` to allow viewing `is_special = true` packages (currently anonymous users can only see `is_special = false`). The guest page will filter client-side based on the link's special status, but RLS needs to permit the query. Alternative: add a policy that allows selecting special packages when accessed via a valid special magic link token.

### Files Modified
- 1 new migration
- `src/hooks/useMagicLinks.ts`
- `src/pages/AdminMagicLinks.tsx`
- `src/pages/GuestUpload.tsx`

