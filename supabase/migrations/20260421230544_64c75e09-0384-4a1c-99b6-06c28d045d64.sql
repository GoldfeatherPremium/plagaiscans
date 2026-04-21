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
    'Welcome to PlagaiScans',
    'Thank you for joining PlagaiScans. Your account is ready — upload a document anytime to receive Turnitin generated Similarity and Ai Detection Reports. Need help getting started? Our support team is available 24/7.'
  );
  RETURN NEW;
END;
$function$;