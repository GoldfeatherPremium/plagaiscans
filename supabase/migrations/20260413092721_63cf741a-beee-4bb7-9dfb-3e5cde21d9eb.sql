
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_referred_by uuid;
  v_referrer_is_special boolean := false;
BEGIN
    -- Parse and validate referred_by
    IF NEW.raw_user_meta_data->>'referred_by' IS NOT NULL 
       AND NEW.raw_user_meta_data->>'referred_by' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN
      v_referred_by := (NEW.raw_user_meta_data->>'referred_by')::uuid;
      -- Check if referrer is special
      SELECT COALESCE(is_special, false) INTO v_referrer_is_special
      FROM public.profiles WHERE id = v_referred_by;
    END IF;

    INSERT INTO public.profiles (id, email, full_name, phone, referred_by, signup_ip, is_special)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            ''
        ),
        COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
        v_referred_by,
        COALESCE(NEW.raw_user_meta_data->>'signup_ip', NULL),
        v_referrer_is_special
    );
    
    -- Assign customer role by default
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'customer');
    
    RETURN NEW;
END;
$function$;
