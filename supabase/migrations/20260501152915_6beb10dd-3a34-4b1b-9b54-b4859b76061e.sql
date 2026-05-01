-- Add columns to track external API processing on documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS external_api_order_id text,
  ADD COLUMN IF NOT EXISTS external_api_status text,
  ADD COLUMN IF NOT EXISTS external_api_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_api_last_polled_at timestamptz,
  ADD COLUMN IF NOT EXISTS external_api_error text,
  ADD COLUMN IF NOT EXISTS external_api_attempt_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_documents_external_api_status
  ON public.documents (external_api_status)
  WHERE external_api_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_external_api_order_id
  ON public.documents (external_api_order_id)
  WHERE external_api_order_id IS NOT NULL;

-- Audit log table for the external API
CREATE TABLE IF NOT EXISTS public.external_api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  order_id text,
  action text NOT NULL,
  status text NOT NULL,
  http_status integer,
  request_payload jsonb,
  response_payload jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_api_logs_document
  ON public.external_api_logs (document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_api_logs_created
  ON public.external_api_logs (created_at DESC);

ALTER TABLE public.external_api_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view external api logs"
  ON public.external_api_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert external api logs"
  ON public.external_api_logs FOR INSERT
  WITH CHECK (true);
