-- Update the welcome notification trigger to remove Turnitin reference
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
    'Hello! We ensure all files are processed securely in non-repository instructor accounts. Your data will not be saved. Thank you for choosing Plagaiscans! 🙂'
  );
  RETURN NEW;
END;
$function$;