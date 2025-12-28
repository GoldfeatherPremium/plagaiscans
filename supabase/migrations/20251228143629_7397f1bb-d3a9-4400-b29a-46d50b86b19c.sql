-- Idempotency table to prevent duplicate crediting for the same Stripe session
CREATE TABLE IF NOT EXISTS public.payment_idempotency_keys (
  key TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'stripe',
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Only admins can view these records (service role bypasses RLS for inserts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payment_idempotency_keys'
      AND policyname = 'Admin can view payment idempotency keys'
  ) THEN
    CREATE POLICY "Admin can view payment idempotency keys"
    ON public.payment_idempotency_keys
    FOR SELECT
    USING (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

-- Helpful index for admin audits
CREATE INDEX IF NOT EXISTS idx_payment_idempotency_keys_user_created
ON public.payment_idempotency_keys (user_id, created_at DESC);