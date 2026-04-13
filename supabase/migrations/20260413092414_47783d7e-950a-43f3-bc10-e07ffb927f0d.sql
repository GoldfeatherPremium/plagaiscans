
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
        CASE 
          WHEN NEW.raw_user_meta_data->>'referred_by' IS NOT NULL 
               AND NEW.raw_user_meta_data->>'referred_by' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          THEN (NEW.raw_user_meta_data->>'referred_by')::uuid
          ELSE NULL
        END,
        COALESCE(NEW.raw_user_meta_data->>'signup_ip', NULL)
    );
    
    -- Assign customer role by default
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'customer');
    
    RETURN NEW;
END;
$function$;
