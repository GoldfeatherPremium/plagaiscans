
CREATE OR REPLACE FUNCTION public.validate_document_upload_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_full_credits INTEGER;
  user_similarity_credits INTEGER;
  valid_full_credits INTEGER;
  valid_similarity_credits INTEGER;
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
    IF user_similarity_credits IS NULL OR user_similarity_credits < 1 THEN
      RAISE EXCEPTION 'Insufficient similarity credits. You need at least 1 similarity credit to upload a document.';
    END IF;
    
    -- Also check if user has non-expired validity records
    SELECT COALESCE(SUM(remaining_credits), 0) INTO valid_similarity_credits
    FROM public.credit_validity
    WHERE user_id = NEW.user_id
      AND credit_type = 'similarity'
      AND expired = false
      AND expires_at > now()
      AND remaining_credits > 0;
    
    -- If there are validity records but none are valid, block
    IF EXISTS (SELECT 1 FROM public.credit_validity WHERE user_id = NEW.user_id AND credit_type = 'similarity') 
       AND valid_similarity_credits < 1 THEN
      RAISE EXCEPTION 'Your similarity credits have expired. Please purchase new credits.';
    END IF;
  ELSE
    IF user_full_credits IS NULL OR user_full_credits < 1 THEN
      RAISE EXCEPTION 'Insufficient credits. You need at least 1 credit to upload a document.';
    END IF;
    
    -- Also check if user has non-expired validity records
    SELECT COALESCE(SUM(remaining_credits), 0) INTO valid_full_credits
    FROM public.credit_validity
    WHERE user_id = NEW.user_id
      AND credit_type = 'full'
      AND expired = false
      AND expires_at > now()
      AND remaining_credits > 0;
    
    -- If there are validity records but none are valid, block
    IF EXISTS (SELECT 1 FROM public.credit_validity WHERE user_id = NEW.user_id AND credit_type = 'full') 
       AND valid_full_credits < 1 THEN
      RAISE EXCEPTION 'Your credits have expired. Please purchase new credits.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
