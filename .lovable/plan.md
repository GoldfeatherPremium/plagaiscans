

## Plan: Comprehensive Referral Fraud Protection System

### Current State
- Basic IP check: compares referrer's signup IP with referred user's IP
- IP log table exists but is not being populated (only signup_ip on profile)
- No rate limiting, email domain checks, device fingerprinting, or admin fraud controls

### New Protections

**1. Server-side fraud validation (new edge function: `validate-referral`)**
Move all fraud detection from client-side (Auth.tsx) to a secure edge function that cannot be bypassed. Checks:
- IP match against referrer's IP
- IP already used in any referral to the same referrer
- Same IP used across multiple referral signups (configurable threshold, default 3)
- Email domain similarity detection (e.g., same base email with +alias like john@gmail vs john+1@gmail)
- Self-referral prevention (referrer cannot refer themselves)
- Rate limiting: max referrals per referrer per day (default 5)
- Disposable email domain blocking (common throwaway domains list)
- Properly logs IP to `referral_ip_log` table on every referral attempt

**2. Database changes (2 migrations)**

Migration 1: Add fraud tracking columns to `referrals`
```sql
ALTER TABLE public.referrals 
  ADD COLUMN IF NOT EXISTS referred_ip text,
  ADD COLUMN IF NOT EXISTS fraud_flagged boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fraud_reason text;
```

Migration 2: Add referral limits to a settings approach + index
```sql
CREATE INDEX IF NOT EXISTS idx_referral_ip_log_ip 
  ON public.referral_ip_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_referral_ip_log_referrer 
  ON public.referral_ip_log(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_created 
  ON public.referrals(referrer_id, created_at);
```

**3. Auth.tsx changes**
- Replace client-side fraud checks with a single call to the `validate-referral` edge function
- Pass IP, email, referral code to the edge function
- Edge function returns whether to proceed or reject

**4. Enhanced `process-referral-reward` checks**
- Before awarding credits, re-verify the referral is not fraud-flagged
- Check referrer hasn't exceeded maximum completed referrals (e.g., 20 lifetime)

**5. AdminReferrals.tsx enhancements**
- Add fraud flag column with visual indicator (red badge)
- Show fraud reason tooltip
- Add ability to manually flag/unflag referrals
- Show IP match warnings (highlight when referrer and referred share IP)
- Add fraud stats card (total flagged, blocked attempts)

### Files Modified
1. `supabase/functions/validate-referral/index.ts` — new edge function for server-side fraud detection
2. `supabase/functions/process-referral-reward/index.ts` — add fraud-flag check before awarding
3. `src/pages/Auth.tsx` — replace client-side checks with edge function call
4. `src/pages/AdminReferrals.tsx` — add fraud monitoring UI
5. Database: 2 migrations (fraud columns + indexes)

