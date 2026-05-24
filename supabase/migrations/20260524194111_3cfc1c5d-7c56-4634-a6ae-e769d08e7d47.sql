
ALTER TABLE public.pricing_packages
  DROP CONSTRAINT IF EXISTS pricing_packages_credit_type_check;

ALTER TABLE public.pricing_packages
  ADD CONSTRAINT pricing_packages_credit_type_check
  CHECK (credit_type = ANY (ARRAY['full'::text, 'similarity_only'::text, 'drillbit_full'::text, 'drillbit_similarity'::text]));
