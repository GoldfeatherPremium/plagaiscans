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
  has_any_validity_records BOOLEAN;
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
    
    -- Check for non-expired validity records with remaining credits
    SELECT COALESCE(SUM(remaining_credits), 0) INTO valid_similarity_credits
    FROM public.credit_validity
    WHERE user_id = NEW.user_id
      AND credit_type = 'similarity'
      AND expired = false
      AND expires_at > now()
      AND remaining_credits > 0;
    
    -- Only block if there are ACTIVE validity records with remaining credits that sum to 0
    -- If all validity records are depleted/expired but profile has balance, allow (admin-added credits)
    SELECT EXISTS (
      SELECT 1 FROM public.credit_validity 
      WHERE user_id = NEW.user_id 
        AND credit_type = 'similarity'
        AND expired = false
        AND expires_at > now()
        AND remaining_credits > 0
    ) INTO has_any_validity_records;
    
    -- If no active validity records with credits exist, check if ALL non-expired records are depleted
    IF NOT has_any_validity_records THEN
      -- Check if there are non-expired records (even with 0 remaining)
      IF EXISTS (
        SELECT 1 FROM public.credit_validity 
        WHERE user_id = NEW.user_id 
          AND credit_type = 'similarity'
          AND expired = false
          AND expires_at > now()
      ) THEN
        -- There are non-expired records but all depleted - allow if profile has balance
        -- (credits may have been added by admin without validity records)
        NULL; -- allow through
      END IF;
    END IF;
  ELSE
    IF user_full_credits IS NULL OR user_full_credits < 1 THEN
      RAISE EXCEPTION 'Insufficient credits. You need at least 1 credit to upload a document.';
    END IF;
    
    -- Check for non-expired validity records with remaining credits
    SELECT COALESCE(SUM(remaining_credits), 0) INTO valid_full_credits
    FROM public.credit_validity
    WHERE user_id = NEW.user_id
      AND credit_type = 'full'
      AND expired = false
      AND expires_at > now()
      AND remaining_credits > 0;
    
    -- Only block if there are ACTIVE validity records with remaining credits that sum to 0
    SELECT EXISTS (
      SELECT 1 FROM public.credit_validity 
      WHERE user_id = NEW.user_id 
        AND credit_type = 'full'
        AND expired = false
        AND expires_at > now()
        AND remaining_credits > 0
    ) INTO has_any_validity_records;
    
    IF NOT has_any_validity_records THEN
      IF EXISTS (
        SELECT 1 FROM public.credit_validity 
        WHERE user_id = NEW.user_id 
          AND credit_type = 'full'
          AND expired = false
          AND expires_at > now()
      ) THEN
        -- Depleted validity records but profile has balance - allow through
        NULL;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$