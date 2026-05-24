
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_scan_type_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_scan_type_check
  CHECK (scan_type = ANY (ARRAY['full'::text, 'similarity_only'::text, 'ai_only_reseller'::text, 'drillbit_full'::text, 'drillbit_similarity_only'::text]));

ALTER TABLE public.credit_validity DROP CONSTRAINT IF EXISTS credit_validity_credit_type_check;
ALTER TABLE public.credit_validity ADD CONSTRAINT credit_validity_credit_type_check
  CHECK (credit_type = ANY (ARRAY['full'::text, 'similarity_only'::text, 'similarity'::text, 'drillbit_full'::text, 'drillbit_similarity'::text]));

ALTER TABLE public.credit_transactions DROP CONSTRAINT IF EXISTS credit_transactions_credit_type_check;
ALTER TABLE public.credit_transactions ADD CONSTRAINT credit_transactions_credit_type_check
  CHECK (credit_type = ANY (ARRAY['full'::text, 'similarity_only'::text, 'similarity'::text, 'drillbit_full'::text, 'drillbit_similarity'::text]));
