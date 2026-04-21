

## Slim Signup to Email + Password — Move Name & Phone to Profile Completion

Reduce signup friction by collecting only what's strictly needed to create the account, then ask for name and phone right after on the existing `/complete-profile` step. This mirrors what already happens for Google OAuth users today.

### What changes for the user

**New signup flow (email/password):**
```text
1. /auth (signup view)
   ├─ Email
   ├─ Password
   ├─ Confirm password
   └─ Referral code (optional)
       → Submit
2. Account created, auto-signed-in
3. Redirected to /complete-profile
   ├─ Full name
   └─ Phone (UK +44 default, optional with helper text)
       → Submit
4. Redirected to /dashboard
```

Google OAuth flow is unchanged (already lands on `/complete-profile`).

Login view is unchanged.

### Implementation

**`src/pages/Auth.tsx`**
- Remove `fullName`, `phone`, `confirmPassword`-stays, but **drop the `fullName` and `PhoneInput` fields** from the signup form and from `signupData` state.
- Update `signupSchema` (zod) to only require `email`, `password`, `confirmPassword` (+ referral stays free-text optional).
- Update `handleSignup` to call `signUp(email, password, '', '', ...)` — pass empty strings for name/phone so the existing AuthContext signature stays intact. Referral logic, IP capture, and welcome email all unchanged.
- Drop `isPhoneValid` state and the `t('validation.phoneInvalid')` early-return.
- After successful signup, navigate to `/complete-profile` instead of `/dashboard` (the existing `needsPhoneNumber` guard would redirect anyway, but explicit nav is cleaner and avoids a flash).
- Remove the now-unused `PhoneInput` import.

**`src/pages/CompleteProfile.tsx`**
- Make phone **optional**: drop the `needsPhone && !isPhoneValid` blockers in submit + button-disabled logic. Only validate format if a value is entered.
- Add a small helper line under the phone field: "Optional — used for WhatsApp delivery alerts and account recovery."
- Keep full-name as required (it's needed for invoices/receipts).
- Title/copy tweak: "Tell us a bit about you" / "Just one more step before your dashboard."

**`src/contexts/AuthContext.tsx`**
- `needsPhoneNumber` currently fires when `!profile.phone || !profile.full_name`. Change it to `!profile.full_name` only (phone is now optional). Rename internally is fine to leave; the boolean stays the trigger for the `/complete-profile` redirect.
- `signUp` signature stays the same — empty `fullName`/`phone` are tolerated by the existing `data` payload and the DB trigger that creates the profile row.

**i18n (`src/i18n/locales/{en,ar,zh,fr,es,de,ru}/auth.json`)**
- Add new keys: `signup.simpleSubtitle`, `completeProfile.optionalPhoneHelper`, `completeProfile.almostThere`. Translate to all 7 languages.
- Existing `signup.fullNameLabel` / `signup.phoneLabel` keys remain (used by `/complete-profile`).

### Edge cases handled
- Referral codes: still applied at signup (not deferred), so reward attribution is preserved.
- Welcome email: still fires from `signUp`; uses `null` for full name when blank, which the function already tolerates.
- Existing users with missing names: next login → routed to `/complete-profile` (already the case).
- Soft-validation: if user tries to skip `/complete-profile` by typing `/dashboard`, `ProtectedRoute` keeps redirecting until name is filled.

### Memory update
Update `mem://auth/onboarding/mandatory-profile-completion-flow` to reflect: signup collects only email + password, and name (required) + phone (optional) are captured on `/complete-profile` for both email and OAuth users.

### Files touched
```
src/pages/Auth.tsx                    (slim signup form + schema + redirect)
src/pages/CompleteProfile.tsx         (phone optional, copy refresh)
src/contexts/AuthContext.tsx          (needsPhoneNumber → name-only check)
src/i18n/locales/{7 langs}/auth.json  (new copy keys)
mem://auth/onboarding/...             (memory refresh)
```

