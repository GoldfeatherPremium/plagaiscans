-- Create dodo_payments table
CREATE TABLE public.dodo_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  payment_id TEXT NOT NULL UNIQUE,
  checkout_session_id TEXT,
  amount_usd NUMERIC NOT NULL,
  credits INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  customer_email TEXT,
  receipt_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.dodo_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own dodo payments"
  ON public.dodo_payments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admin can view all dodo payments"
  ON public.dodo_payments FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can manage dodo payments"
  ON public.dodo_payments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert dodo payments"
  ON public.dodo_payments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update dodo payments"
  ON public.dodo_payments FOR UPDATE
  USING (true);

-- Add Dodo settings to settings table
INSERT INTO public.settings (key, value) VALUES 
  ('payment_dodo_enabled', 'false'),
  ('fee_dodo', '0')
ON CONFLICT (key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX idx_dodo_payments_user_id ON public.dodo_payments(user_id);
CREATE INDEX idx_dodo_payments_payment_id ON public.dodo_payments(payment_id);
CREATE INDEX idx_dodo_payments_status ON public.dodo_payments(status);