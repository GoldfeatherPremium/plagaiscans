
-- Function to deduct remaining_credits from credit_validity on credit usage (FIFO)
CREATE OR REPLACE FUNCTION public.deduct_credit_validity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  usage_amount INTEGER;
  validity_record RECORD;
  to_deduct INTEGER;
BEGIN
  -- Only process negative amounts (credit usage/deduction)
  IF NEW.amount >= 0 THEN
    RETURN NEW;
  END IF;

  -- Skip expiration transactions to avoid circular deduction
  IF NEW.transaction_type = 'expiration' THEN
    RETURN NEW;
  END IF;

  usage_amount := ABS(NEW.amount);

  -- Loop through active credit_validity records in FIFO order (oldest expiry first)
  FOR validity_record IN
    SELECT id, remaining_credits
    FROM public.credit_validity
    WHERE user_id = NEW.user_id
      AND credit_type = NEW.credit_type
      AND expired = false
      AND remaining_credits > 0
    ORDER BY expires_at ASC
  LOOP
    EXIT WHEN usage_amount <= 0;

    to_deduct := LEAST(validity_record.remaining_credits, usage_amount);

    UPDATE public.credit_validity
    SET remaining_credits = remaining_credits - to_deduct
    WHERE id = validity_record.id;

    usage_amount := usage_amount - to_deduct;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger: fire after insert on credit_transactions when amount is negative
CREATE TRIGGER trg_deduct_credit_validity
AFTER INSERT ON public.credit_transactions
FOR EACH ROW
WHEN (NEW.amount < 0)
EXECUTE FUNCTION public.deduct_credit_validity();
