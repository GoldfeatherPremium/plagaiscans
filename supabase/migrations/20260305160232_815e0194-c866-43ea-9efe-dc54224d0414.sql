
-- Drop old constraint and add expanded one
ALTER TABLE public.credit_transactions DROP CONSTRAINT credit_transactions_transaction_type_check;
ALTER TABLE public.credit_transactions ADD CONSTRAINT credit_transactions_transaction_type_check 
  CHECK (transaction_type = ANY (ARRAY['add'::text, 'deduct'::text, 'usage'::text, 'deduction'::text, 'expiration'::text, 'refund'::text]));
