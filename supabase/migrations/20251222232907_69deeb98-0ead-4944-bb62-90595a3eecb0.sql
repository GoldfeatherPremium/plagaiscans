-- Create a function to validate credits before document insertion
CREATE OR REPLACE FUNCTION public.validate_document_upload_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_credits INTEGER;
BEGIN
  -- Skip validation for magic link uploads (guest uploads don't require credits)
  IF NEW.magic_link_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Skip validation if user_id is null
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get user's current credit balance
  SELECT credit_balance INTO user_credits
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  -- Check if user has sufficient credits
  IF user_credits IS NULL OR user_credits < 1 THEN
    RAISE EXCEPTION 'Insufficient credits. You need at least 1 credit to upload a document.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to validate credits before document insertion
DROP TRIGGER IF EXISTS validate_credits_before_upload ON public.documents;
CREATE TRIGGER validate_credits_before_upload
  BEFORE INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_document_upload_credits();