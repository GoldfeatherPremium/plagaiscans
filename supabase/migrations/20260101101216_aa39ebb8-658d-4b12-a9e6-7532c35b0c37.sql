-- Fix the validate_document_upload_credits trigger to check the correct credit type
CREATE OR REPLACE FUNCTION public.validate_document_upload_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_full_credits INTEGER;
  user_similarity_credits INTEGER;
BEGIN
  -- Skip validation for magic link uploads (guest uploads don't require credits)
  IF NEW.magic_link_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Skip validation if user_id is null
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get user's current credit balances
  SELECT credit_balance, similarity_credit_balance 
  INTO user_full_credits, user_similarity_credits
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  -- Check credits based on scan_type
  IF NEW.scan_type = 'similarity_only' THEN
    -- For similarity-only scans, check similarity credits
    IF user_similarity_credits IS NULL OR user_similarity_credits < 1 THEN
      RAISE EXCEPTION 'Insufficient similarity credits. You need at least 1 similarity credit to upload a document.';
    END IF;
  ELSE
    -- For full scans (default), check full credits
    IF user_full_credits IS NULL OR user_full_credits < 1 THEN
      RAISE EXCEPTION 'Insufficient credits. You need at least 1 credit to upload a document.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;