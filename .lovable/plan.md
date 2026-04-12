

## Plan: Comprehensive Referral System

### What You Get
- IP-based fraud detection prevents the same person from self-referring with multiple emails
- Both referrer and referred user get 1 free credit when the referred user makes their first purchase
- Referral credits expire in 3 days
- Full tracking in the existing referral UI and admin panel

### Database Changes (3 migrations)

**Migration 1: Add IP tracking to profiles**
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_ip text;
```

**Migration 2: Create referral IP tracking table**
```sql
CREATE TABLE public.referral_ip_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  user_id uuid NOT NULL,
  referrer_id uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.referral_ip_log ENABLE ROW LEVEL SECURITY;
-- Admin-only read policy
CREATE POLICY "Admins can view referral IPs" ON public.referral_ip_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

**Migration 3: Add `reward_given_to_referred` column to referrals**
```sql
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS reward_given_to_referred boolean DEFAULT false;
```

### Edge Function: `process-referral-reward`
New edge function triggered after any successful payment (Stripe, Paddle, PayPal, Dodo, manual). It will:
1. Look up the paying user's `referred_by` field in profiles
2. Check if the referral is still `pending` (first purchase only)
3. Award 1 credit to referrer (profile balance + credit_validity with 3-day expiry + credit_transaction)
4. Award 1 credit to referred user (same pattern, 3-day expiry)
5. Update referral record: status = 'completed', credits_earned = 1, reward_given_to_referred = true
6. Send notifications to both users

### Auth.tsx Changes
- Read `?ref=` query param on signup page
- Store referral code in `signUp()` metadata
- After signup, look up referrer by code, set `referred_by` on profile, create pending referral record, capture IP

### handle_new_user Trigger Update
- Extract `referred_by` from user metadata and save to profile
- Capture signup IP from metadata

### Webhook Integration (Stripe, Paddle, PayPal, Dodo, manual payments)
After credits are added successfully, call `process-referral-reward` to check and award referral bonuses. This is done by adding a helper function call in each webhook's payment success path.

### IP Fraud Detection Logic (in Auth.tsx + edge function)
- On signup with a referral code, capture the user's IP via a lightweight edge function
- Store IP in `referral_ip_log`
- Before creating the referral, check if the same IP was already used by the referrer or any other account that referred to the same referrer — if so, reject the referral silently (account still created, but no referral link established)

### ReferralProgram.tsx Updates
- Change `REFERRAL_BONUS` from 5 to 1
- Add note about 3-day credit expiry in the "How It Works" section
- Update text to reflect both parties getting 1 credit

### AdminReferrals.tsx Updates  
- Show IP address column for fraud monitoring
- Show whether referred user reward was given

### Files Modified
1. `src/pages/Auth.tsx` — capture ref code, pass in signup metadata, record IP
2. `src/pages/ReferralProgram.tsx` — update bonus amount, add expiry info
3. `src/pages/AdminReferrals.tsx` — add IP column, reward status
4. `src/contexts/AuthContext.tsx` — pass referral metadata in signUp
5. `supabase/functions/process-referral-reward/index.ts` — new edge function
6. `supabase/functions/stripe-webhook/index.ts` — call referral reward after payment
7. `supabase/functions/paddle-webhook/index.ts` — call referral reward after payment
8. `supabase/functions/dodo-webhook/index.ts` — call referral reward after payment
9. `supabase/functions/paypal-webhook/index.ts` — call referral reward after payment
10. Database: 3 migrations (IP column, IP log table, referral reward column)
11. Trigger update: `handle_new_user` to store referred_by and IP

