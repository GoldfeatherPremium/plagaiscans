
-- Resellers table
CREATE TABLE public.resellers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_name TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active | suspended
  credit_balance INTEGER NOT NULL DEFAULT 0,
  total_credits_purchased INTEGER NOT NULL DEFAULT 0,
  total_credits_used INTEGER NOT NULL DEFAULT 0,
  webhook_url TEXT,
  webhook_secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  rate_limit_per_min INTEGER NOT NULL DEFAULT 60,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages resellers" ON public.resellers FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_resellers_updated_at BEFORE UPDATE ON public.resellers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reseller API Keys
CREATE TABLE public.reseller_api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE, -- sha256 of the full api key
  key_prefix TEXT NOT NULL, -- first 12 chars (e.g. "psk_live_ab1")
  label TEXT,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reseller_api_keys_hash ON public.reseller_api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_reseller_api_keys_reseller ON public.reseller_api_keys(reseller_id);

ALTER TABLE public.reseller_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages reseller api keys" ON public.reseller_api_keys FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Reseller credit transactions
CREATE TABLE public.reseller_credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  transaction_type TEXT NOT NULL, -- topup | deduction | refund | adjustment
  description TEXT,
  scan_id UUID,
  performed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reseller_credit_tx_reseller ON public.reseller_credit_transactions(reseller_id, created_at DESC);

ALTER TABLE public.reseller_credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin views reseller credit tx" ON public.reseller_credit_transactions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "System inserts reseller credit tx" ON public.reseller_credit_transactions FOR INSERT WITH CHECK (true);

-- Reseller scans
CREATE TABLE public.reseller_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.reseller_api_keys(id) ON DELETE SET NULL,
  external_reference TEXT,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | processing | completed | failed | cancelled
  ai_percentage NUMERIC,
  ai_report_path TEXT,
  error TEXT,
  ip_address TEXT,
  webhook_delivered BOOLEAN NOT NULL DEFAULT false,
  webhook_attempts INTEGER NOT NULL DEFAULT 0,
  webhook_next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reseller_scans_reseller ON public.reseller_scans(reseller_id, created_at DESC);
CREATE INDEX idx_reseller_scans_document ON public.reseller_scans(document_id);
CREATE INDEX idx_reseller_scans_status ON public.reseller_scans(status);
CREATE INDEX idx_reseller_scans_webhook_pending ON public.reseller_scans(webhook_next_retry_at) WHERE webhook_delivered = false AND status IN ('completed','failed');

ALTER TABLE public.reseller_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin views reseller scans" ON public.reseller_scans FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "System manages reseller scans" ON public.reseller_scans FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_reseller_scans_updated_at BEFORE UPDATE ON public.reseller_scans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Reseller webhook logs
CREATE TABLE public.reseller_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  scan_id UUID REFERENCES public.reseller_scans(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  payload JSONB,
  response_status INTEGER,
  response_body TEXT,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  succeeded BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reseller_webhook_logs_reseller ON public.reseller_webhook_logs(reseller_id, created_at DESC);
CREATE INDEX idx_reseller_webhook_logs_scan ON public.reseller_webhook_logs(scan_id);

ALTER TABLE public.reseller_webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin views reseller webhook logs" ON public.reseller_webhook_logs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "System inserts reseller webhook logs" ON public.reseller_webhook_logs FOR INSERT WITH CHECK (true);

-- Reseller API logs
CREATE TABLE public.reseller_api_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID REFERENCES public.resellers(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES public.reseller_api_keys(id) ON DELETE SET NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  response_time_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reseller_api_logs_reseller ON public.reseller_api_logs(reseller_id, created_at DESC);

ALTER TABLE public.reseller_api_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin views reseller api logs" ON public.reseller_api_logs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "System inserts reseller api logs" ON public.reseller_api_logs FOR INSERT WITH CHECK (true);

-- Add reseller_scan_id to documents to mark documents as belonging to reseller flow (so they're excluded from regular queues)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS reseller_scan_id UUID REFERENCES public.reseller_scans(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_reseller_scan ON public.documents(reseller_scan_id);

-- Skip credit validation trigger for reseller-flow documents
CREATE OR REPLACE FUNCTION public.validate_document_upload_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_full_credits INTEGER;
  user_similarity_credits INTEGER;
  has_any_validity_records BOOLEAN;
BEGIN
  -- Skip for magic link uploads
  IF NEW.magic_link_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  -- Skip for reseller flow (credits handled separately)
  IF NEW.reseller_scan_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT credit_balance, similarity_credit_balance
  INTO user_full_credits, user_similarity_credits
  FROM public.profiles WHERE id = NEW.user_id;

  IF NEW.scan_type = 'similarity_only' THEN
    IF user_similarity_credits IS NULL OR user_similarity_credits < 1 THEN
      RAISE EXCEPTION 'Insufficient similarity credits. You need at least 1 similarity credit to upload a document.';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.credit_validity
      WHERE user_id = NEW.user_id AND credit_type = 'similarity'
        AND expired = false AND expires_at > now() AND remaining_credits > 0
    ) INTO has_any_validity_records;
    IF NOT has_any_validity_records THEN
      IF EXISTS (
        SELECT 1 FROM public.credit_validity
        WHERE user_id = NEW.user_id AND credit_type = 'similarity'
          AND expired = false AND expires_at > now()
      ) THEN NULL; END IF;
    END IF;
  ELSE
    IF user_full_credits IS NULL OR user_full_credits < 1 THEN
      RAISE EXCEPTION 'Insufficient credits. You need at least 1 credit to upload a document.';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.credit_validity
      WHERE user_id = NEW.user_id AND credit_type = 'full'
        AND expired = false AND expires_at > now() AND remaining_credits > 0
    ) INTO has_any_validity_records;
    IF NOT has_any_validity_records THEN
      IF EXISTS (
        SELECT 1 FROM public.credit_validity
        WHERE user_id = NEW.user_id AND credit_type = 'full'
          AND expired = false AND expires_at > now()
      ) THEN NULL; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Atomic top-up function
CREATE OR REPLACE FUNCTION public.topup_reseller_credits(
  p_reseller_id UUID, p_amount INTEGER, p_description TEXT DEFAULT 'Admin top-up', p_performed_by UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before INTEGER; v_after INTEGER;
BEGIN
  IF p_amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive'); END IF;
  SELECT credit_balance INTO v_before FROM public.resellers WHERE id = p_reseller_id FOR UPDATE;
  IF v_before IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Reseller not found'); END IF;
  v_after := v_before + p_amount;
  UPDATE public.resellers SET credit_balance = v_after, total_credits_purchased = total_credits_purchased + p_amount WHERE id = p_reseller_id;
  INSERT INTO public.reseller_credit_transactions (reseller_id, amount, balance_before, balance_after, transaction_type, description, performed_by)
  VALUES (p_reseller_id, p_amount, v_before, v_after, 'topup', p_description, p_performed_by);
  RETURN jsonb_build_object('success', true, 'balance_before', v_before, 'balance_after', v_after);
END; $$;

-- Atomic deduction function
CREATE OR REPLACE FUNCTION public.consume_reseller_credit(
  p_reseller_id UUID, p_scan_id UUID DEFAULT NULL, p_description TEXT DEFAULT 'AI scan'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before INTEGER; v_after INTEGER;
BEGIN
  SELECT credit_balance INTO v_before FROM public.resellers WHERE id = p_reseller_id FOR UPDATE;
  IF v_before IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Reseller not found'); END IF;
  IF v_before < 1 THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits'); END IF;
  v_after := v_before - 1;
  UPDATE public.resellers SET credit_balance = v_after, total_credits_used = total_credits_used + 1 WHERE id = p_reseller_id;
  INSERT INTO public.reseller_credit_transactions (reseller_id, amount, balance_before, balance_after, transaction_type, description, scan_id)
  VALUES (p_reseller_id, -1, v_before, v_after, 'deduction', p_description, p_scan_id);
  RETURN jsonb_build_object('success', true, 'balance_before', v_before, 'balance_after', v_after);
END; $$;

-- Refund function
CREATE OR REPLACE FUNCTION public.refund_reseller_credit(
  p_reseller_id UUID, p_scan_id UUID DEFAULT NULL, p_description TEXT DEFAULT 'Scan refund'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before INTEGER; v_after INTEGER;
BEGIN
  SELECT credit_balance INTO v_before FROM public.resellers WHERE id = p_reseller_id FOR UPDATE;
  IF v_before IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Reseller not found'); END IF;
  v_after := v_before + 1;
  UPDATE public.resellers SET credit_balance = v_after, total_credits_used = GREATEST(0, total_credits_used - 1) WHERE id = p_reseller_id;
  INSERT INTO public.reseller_credit_transactions (reseller_id, amount, balance_before, balance_after, transaction_type, description, scan_id)
  VALUES (p_reseller_id, 1, v_before, v_after, 'refund', p_description, p_scan_id);
  RETURN jsonb_build_object('success', true);
END; $$;
