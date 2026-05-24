ALTER TABLE public.manual_payments
  ADD COLUMN IF NOT EXISTS credit_type text NOT NULL DEFAULT 'full';

ALTER TABLE public.manual_payments
  DROP CONSTRAINT IF EXISTS manual_payments_credit_type_check;

ALTER TABLE public.manual_payments
  ADD CONSTRAINT manual_payments_credit_type_check
  CHECK (credit_type = ANY (ARRAY['full','similarity_only','drillbit_full','drillbit_similarity']));