-- Update the welcome notification function to remove Turnitin reference
CREATE OR REPLACE FUNCTION public.send_welcome_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_notifications (user_id, title, message)
  VALUES (
    NEW.id,
    'Welcome 🙏',
    'Hello Everyone! We ensure that all files are processed securely in non-repository instructor accounts. Your data will not be saved. Thanks for your attention 🙂 ☺️'
  );
  RETURN NEW;
END;
$function$;