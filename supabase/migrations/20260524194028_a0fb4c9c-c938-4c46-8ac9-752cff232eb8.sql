
-- 1. Add Drillbit balances to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS drillbit_credit_balance integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drillbit_similarity_credit_balance integer NOT NULL DEFAULT 0;

-- 2. Update consume_user_credit to handle drillbit credit types
CREATE OR REPLACE FUNCTION public.consume_user_credit(
  p_user_id uuid,
  p_credit_type text DEFAULT 'full'::text,
  p_description text DEFAULT 'Credit used'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
BEGIN
  IF p_credit_type IN ('similarity', 'similarity_only') THEN
    SELECT similarity_credit_balance INTO v_current_balance
    FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  ELSIF p_credit_type = 'drillbit_full' THEN
    SELECT drillbit_credit_balance INTO v_current_balance
    FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  ELSIF p_credit_type IN ('drillbit_similarity', 'drillbit_similarity_only') THEN
    SELECT drillbit_similarity_credit_balance INTO v_current_balance
    FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  ELSE
    SELECT credit_balance INTO v_current_balance
    FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  END IF;

  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile not found');
  END IF;
  IF v_current_balance < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits');
  END IF;

  v_new_balance := v_current_balance - 1;

  IF p_credit_type IN ('similarity', 'similarity_only') THEN
    UPDATE public.profiles SET similarity_credit_balance = v_new_balance WHERE id = p_user_id;
  ELSIF p_credit_type = 'drillbit_full' THEN
    UPDATE public.profiles SET drillbit_credit_balance = v_new_balance WHERE id = p_user_id;
  ELSIF p_credit_type IN ('drillbit_similarity', 'drillbit_similarity_only') THEN
    UPDATE public.profiles SET drillbit_similarity_credit_balance = v_new_balance WHERE id = p_user_id;
  ELSE
    UPDATE public.profiles SET credit_balance = v_new_balance WHERE id = p_user_id;
  END IF;

  INSERT INTO public.credit_transactions (
    user_id, amount, balance_before, balance_after,
    transaction_type, credit_type, description, performed_by
  ) VALUES (
    p_user_id, -1, v_current_balance, v_new_balance,
    'deduction', p_credit_type, p_description, p_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'balance_before', v_current_balance,
    'balance_after', v_new_balance
  );
END;
$function$;

-- 3. Update validate_document_upload_credits to check drillbit balances
CREATE OR REPLACE FUNCTION public.validate_document_upload_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_full_credits INTEGER;
  user_similarity_credits INTEGER;
  user_drillbit_full INTEGER;
  user_drillbit_sim INTEGER;
BEGIN
  IF NEW.magic_link_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.reseller_scan_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;

  SELECT credit_balance, similarity_credit_balance,
         drillbit_credit_balance, drillbit_similarity_credit_balance
  INTO user_full_credits, user_similarity_credits,
       user_drillbit_full, user_drillbit_sim
  FROM public.profiles WHERE id = NEW.user_id;

  IF NEW.scan_type = 'similarity_only' THEN
    IF COALESCE(user_similarity_credits, 0) < 1 THEN
      RAISE EXCEPTION 'Insufficient similarity credits. You need at least 1 similarity credit to upload a document.';
    END IF;
  ELSIF NEW.scan_type = 'drillbit_full' THEN
    IF COALESCE(user_drillbit_full, 0) < 1 THEN
      RAISE EXCEPTION 'Insufficient Drillbit (AI + Similarity) credits. You need at least 1 credit to upload a document.';
    END IF;
  ELSIF NEW.scan_type = 'drillbit_similarity_only' THEN
    IF COALESCE(user_drillbit_sim, 0) < 1 THEN
      RAISE EXCEPTION 'Insufficient Drillbit similarity credits. You need at least 1 credit to upload a document.';
    END IF;
  ELSE
    IF COALESCE(user_full_credits, 0) < 1 THEN
      RAISE EXCEPTION 'Insufficient credits. You need at least 1 credit to upload a document.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
