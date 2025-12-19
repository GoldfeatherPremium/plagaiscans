-- Create a trigger function to send welcome notification to new users
CREATE OR REPLACE FUNCTION public.send_welcome_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_notifications (user_id, title, message)
  VALUES (
    NEW.id,
    'Welcome 🙏',
    'Hello Everyone! We ensure everyone of you that all the files are processed in Non Repository Turnitin Instructor Accounts. All your data will not be saved there. Thanks for attention 🙂 ☺️'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger on profiles table
DROP TRIGGER IF EXISTS on_profile_created_welcome ON public.profiles;
CREATE TRIGGER on_profile_created_welcome
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.send_welcome_notification();