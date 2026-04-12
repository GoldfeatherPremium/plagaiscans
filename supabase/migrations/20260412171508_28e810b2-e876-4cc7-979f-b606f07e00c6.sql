
ALTER TABLE public.referrals 
  ADD COLUMN IF NOT EXISTS referred_ip text,
  ADD COLUMN IF NOT EXISTS fraud_flagged boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fraud_reason text;

CREATE INDEX IF NOT EXISTS idx_referral_ip_log_ip ON public.referral_ip_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_referral_ip_log_referrer ON public.referral_ip_log(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_created ON public.referrals(referrer_id, created_at);
