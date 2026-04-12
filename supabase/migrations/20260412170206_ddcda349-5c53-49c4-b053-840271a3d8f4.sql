
-- Migration 1: Add signup_ip to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_ip text;

-- Migration 2: Create referral IP tracking table
CREATE TABLE IF NOT EXISTS public.referral_ip_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  user_id uuid NOT NULL,
  referrer_id uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.referral_ip_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view referral IPs" ON public.referral_ip_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert referral IPs" ON public.referral_ip_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Migration 3: Add reward_given_to_referred to referrals
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS reward_given_to_referred boolean DEFAULT false;

-- Update handle_new_user trigger to capture referred_by and signup_ip
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, phone, referred_by, signup_ip)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            ''
        ),
        COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
        COALESCE(NEW.raw_user_meta_data->>'referred_by', NULL),
        COALESCE(NEW.raw_user_meta_data->>'signup_ip', NULL)
    );
    
    -- Assign customer role by default
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'customer');
    
    RETURN NEW;
END;
$function$;
