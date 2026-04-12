
-- Add advanced fraud columns to referrals
ALTER TABLE public.referrals 
  ADD COLUMN IF NOT EXISTS reward_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reward_delay_until timestamptz,
  ADD COLUMN IF NOT EXISTS activity_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_amount_usd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ip_cluster_id text;

-- Add shadow ban to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shadow_banned boolean DEFAULT false;

-- Fraud audit log table
CREATE TABLE IF NOT EXISTS public.referral_fraud_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid REFERENCES public.referrals(id) ON DELETE CASCADE,
  referrer_id uuid,
  referred_user_id uuid,
  check_type text NOT NULL,
  check_result text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.referral_fraud_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view fraud logs" ON public.referral_fraud_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert fraud logs" ON public.referral_fraud_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_shadow_banned ON public.profiles(shadow_banned) WHERE shadow_banned = true;
CREATE INDEX IF NOT EXISTS idx_referrals_reward_status ON public.referrals(reward_status);
CREATE INDEX IF NOT EXISTS idx_referrals_reward_delay ON public.referrals(reward_delay_until) WHERE reward_status = 'delayed';
CREATE INDEX IF NOT EXISTS idx_referral_fraud_logs_referral ON public.referral_fraud_logs(referral_id);
