
-- Create atomic credit consumption function
CREATE OR REPLACE FUNCTION public.consume_user_credit(
  p_user_id uuid,
  p_credit_type text DEFAULT 'full',
  p_description text DEFAULT 'Credit used'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_balance_field text;
  v_current_balance integer;
  v_new_balance integer;
  v_validity_record RECORD;
  v_to_deduct integer;
  v_remaining integer := 1;
BEGIN
  -- Determine which balance field to use
  IF p_credit_type = 'similarity' OR p_credit_type = 'similarity_only' THEN
    SELECT similarity_credit_balance INTO v_current_balance
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;
  ELSE
    SELECT credit_balance INTO v_current_balance
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;
  END IF;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;

  IF v_current_balance < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits');
  END IF;

  v_new_balance := v_current_balance - 1;

  -- Update profile balance
  IF p_credit_type = 'similarity' OR p_credit_type = 'similarity_only' THEN
    UPDATE public.profiles
    SET similarity_credit_balance = v_new_balance
    WHERE id = p_user_id;
  ELSE
    UPDATE public.profiles
    SET credit_balance = v_new_balance
    WHERE id = p_user_id;
  END IF;

  -- Insert credit transaction
  INSERT INTO public.credit_transactions (
    user_id, amount, balance_before, balance_after,
    transaction_type, credit_type, description, performed_by
  ) VALUES (
    p_user_id, -1, v_current_balance, v_new_balance,
    'deduction', p_credit_type, p_description, p_user_id
  );

  -- FIFO deduct from credit_validity (oldest expiry first)
  -- The trigger deduct_credit_validity will also fire on the transaction insert,
  -- but we do it explicitly here and skip in the trigger to avoid double-deduction.
  -- Actually, since the trigger checks NEW.amount < 0, it will fire.
  -- To avoid double deduction, we'll remove the trigger-based approach
  -- and handle it entirely here. But we can't drop the trigger in this function.
  -- Instead, we'll rely on the trigger since we're now inserting the transaction reliably.

  RETURN jsonb_build_object(
    'success', true,
    'balance_before', v_current_balance,
    'balance_after', v_new_balance
  );
END;
$$;
