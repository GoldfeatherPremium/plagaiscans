
-- One-time backfill: For each credit_validity record, calculate how many credits
-- were actually used via negative credit_transactions during its validity period,
-- and adjust remaining_credits accordingly.
-- We use a DO block so this runs once and doesn't create a persistent object.

DO $$
DECLARE
  cv_record RECORD;
  total_used INTEGER;
  already_expired_used INTEGER;
  new_remaining INTEGER;
BEGIN
  -- Process each non-expired credit_validity record per user+credit_type
  -- We need to apply FIFO: for each user/credit_type, sum usage and distribute across batches oldest-first
  
  FOR cv_record IN
    SELECT DISTINCT user_id, credit_type
    FROM public.credit_validity
    WHERE expired = false
  LOOP
    -- Get total credits used (negative transactions) for this user+credit_type
    -- that are NOT expiration transactions
    SELECT COALESCE(SUM(ABS(amount)), 0)
    INTO total_used
    FROM public.credit_transactions
    WHERE user_id = cv_record.user_id
      AND credit_type = cv_record.credit_type
      AND amount < 0
      AND transaction_type != 'expiration';

    -- Now distribute usage across batches in FIFO order
    DECLARE
      batch RECORD;
      remaining_usage INTEGER := total_used;
      batch_deduct INTEGER;
    BEGIN
      FOR batch IN
        SELECT id, credits_amount, remaining_credits
        FROM public.credit_validity
        WHERE user_id = cv_record.user_id
          AND credit_type = cv_record.credit_type
          AND expired = false
        ORDER BY expires_at ASC
      LOOP
        EXIT WHEN remaining_usage <= 0;
        
        batch_deduct := LEAST(batch.credits_amount, remaining_usage);
        new_remaining := batch.credits_amount - batch_deduct;
        
        UPDATE public.credit_validity
        SET remaining_credits = new_remaining
        WHERE id = batch.id;
        
        remaining_usage := remaining_usage - batch_deduct;
      END LOOP;
    END;
  END LOOP;
END;
$$;
