-- Create USDT TRC20 payments table with comprehensive tracking
CREATE TABLE public.usdt_trc20_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  order_id TEXT UNIQUE NOT NULL,
  
  -- Amount tracking
  expected_usdt_amount NUMERIC(20, 6) NOT NULL,
  received_usdt_amount NUMERIC(20, 6) DEFAULT 0,
  credits_to_add INTEGER NOT NULL,
  credits_added INTEGER DEFAULT 0,
  
  -- Wallet info (derivation path index, not storing private keys directly)
  wallet_address TEXT NOT NULL,
  wallet_index INTEGER NOT NULL,
  
  -- Transaction tracking
  tx_hash TEXT,
  tx_confirmations INTEGER DEFAULT 0,
  
  -- Status management
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirming', 'confirmed', 'underpaid', 'overpaid', 'expired', 'refunded', 'cancelled')),
  
  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  
  -- Admin actions
  admin_verified_by UUID,
  admin_verified_at TIMESTAMPTZ,
  admin_notes TEXT,
  
  -- Refund tracking
  refund_wallet_address TEXT,
  refund_amount NUMERIC(20, 6),
  refund_tx_hash TEXT,
  refunded_at TIMESTAMPTZ,
  refunded_by UUID,
  
  -- Security
  ip_address TEXT,
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for wallet address lookups (blockchain monitoring)
CREATE UNIQUE INDEX idx_usdt_payments_wallet ON public.usdt_trc20_payments(wallet_address);
CREATE INDEX idx_usdt_payments_status ON public.usdt_trc20_payments(status);
CREATE INDEX idx_usdt_payments_user ON public.usdt_trc20_payments(user_id);
CREATE INDEX idx_usdt_payments_expires ON public.usdt_trc20_payments(expires_at) WHERE status = 'pending';

-- Rate limiting table
CREATE TABLE public.usdt_payment_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rate_limits_user ON public.usdt_payment_rate_limits(user_id, created_at);
CREATE INDEX idx_rate_limits_ip ON public.usdt_payment_rate_limits(ip_address, created_at);

-- Wallet index counter (for HD derivation)
CREATE TABLE public.usdt_wallet_counter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  current_index INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Initialize wallet counter
INSERT INTO public.usdt_wallet_counter (current_index) VALUES (0);

-- TX hash uniqueness tracking
CREATE TABLE public.usdt_used_tx_hashes (
  tx_hash TEXT PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.usdt_trc20_payments(id),
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit log for admin actions
CREATE TABLE public.usdt_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.usdt_trc20_payments(id),
  admin_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.usdt_trc20_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usdt_payment_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usdt_wallet_counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usdt_used_tx_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usdt_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for usdt_trc20_payments
CREATE POLICY "Users can view own USDT payments"
ON public.usdt_trc20_payments FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create USDT payments"
ON public.usdt_trc20_payments FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can view all USDT payments"
ON public.usdt_trc20_payments FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can update USDT payments"
ON public.usdt_trc20_payments FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can update USDT payments"
ON public.usdt_trc20_payments FOR UPDATE
USING (true);

CREATE POLICY "System can insert USDT payments"
ON public.usdt_trc20_payments FOR INSERT
WITH CHECK (true);

-- RLS for rate limits (system only)
CREATE POLICY "System can manage rate limits"
ON public.usdt_payment_rate_limits FOR ALL
USING (true);

-- RLS for wallet counter (system only)
CREATE POLICY "System can manage wallet counter"
ON public.usdt_wallet_counter FOR ALL
USING (true);

-- RLS for used tx hashes
CREATE POLICY "System can manage tx hashes"
ON public.usdt_used_tx_hashes FOR ALL
USING (true);

CREATE POLICY "Admin can view tx hashes"
ON public.usdt_used_tx_hashes FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- RLS for audit log
CREATE POLICY "Admin can view audit log"
ON public.usdt_audit_log FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can insert audit log"
ON public.usdt_audit_log FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "System can insert audit log"
ON public.usdt_audit_log FOR INSERT
WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_usdt_payments_updated_at
BEFORE UPDATE ON public.usdt_trc20_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add USDT TRC20 toggle to settings if not exists
INSERT INTO public.settings (key, value)
VALUES ('usdt_trc20_enabled', 'true')
ON CONFLICT (key) DO NOTHING;