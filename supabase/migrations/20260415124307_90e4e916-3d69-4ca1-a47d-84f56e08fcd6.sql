
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referred_by uuid := NULL;
  v_referrer_is_special boolean := false;
  v_guest_special boolean := false;
  v_referral_code text := NULL;
  v_signup_ip text := NULL;
BEGIN
  -- Safely extract referred_by UUID
  IF NEW.raw_user_meta_data->>'referred_by' IS NOT NULL 
     AND NEW.raw_user_meta_data->>'referred_by' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  THEN
    v_referred_by := (NEW.raw_user_meta_data->>'referred_by')::uuid;
  END IF;

  -- Extract referral code and signup IP from metadata
  v_referral_code := NEW.raw_user_meta_data->>'referral_code';
  v_signup_ip := NEW.raw_user_meta_data->>'signup_ip';

  -- Check if referrer is special
  IF v_referred_by IS NOT NULL THEN
    SELECT COALESCE(is_special, false) INTO v_referrer_is_special
    FROM public.profiles WHERE id = v_referred_by;
  END IF;

  -- Check if guest signed up from a special magic link
  IF NEW.raw_user_meta_data->>'guest_special' = 'true' THEN
    v_guest_special := true;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, referred_by, is_special, signup_ip)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    v_referred_by,
    (v_referrer_is_special OR v_guest_special),
    v_signup_ip
  );

  -- Create referral record if user was referred
  IF v_referred_by IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_user_id, referral_code, status, credits_earned, referred_ip, reward_status)
    VALUES (v_referred_by, NEW.id, COALESCE(v_referral_code, ''), 'pending', 0, v_signup_ip, 'pending')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Assign default customer role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
