
CREATE TABLE IF NOT EXISTS public.external_api_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  api_token text NOT NULL,
  max_concurrency integer NOT NULL DEFAULT 4,
  enabled boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.external_api_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage external api accounts"
ON public.external_api_accounts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_external_api_accounts_updated_at
BEFORE UPDATE ON public.external_api_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS external_api_account_id uuid REFERENCES public.external_api_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_external_api_account_id ON public.documents(external_api_account_id);
