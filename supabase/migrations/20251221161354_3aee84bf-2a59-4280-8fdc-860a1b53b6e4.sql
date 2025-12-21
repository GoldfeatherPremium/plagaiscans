-- Create table for Viva.com payments
CREATE TABLE public.viva_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  order_code TEXT NOT NULL UNIQUE,
  amount_usd NUMERIC(10,2) NOT NULL,
  credits INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_id TEXT,
  merchant_trns TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.viva_payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "Users can view their own viva payments"
ON public.viva_payments
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all payments
CREATE POLICY "Admins can view all viva payments"
ON public.viva_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- System can insert payments (via service role)
CREATE POLICY "System can insert viva payments"
ON public.viva_payments
FOR INSERT
WITH CHECK (true);

-- System can update payments (via service role)
CREATE POLICY "System can update viva payments"
ON public.viva_payments
FOR UPDATE
USING (true);

-- Add index for faster lookups
CREATE INDEX idx_viva_payments_user_id ON public.viva_payments(user_id);
CREATE INDEX idx_viva_payments_order_code ON public.viva_payments(order_code);
CREATE INDEX idx_viva_payments_status ON public.viva_payments(status);

-- Add updated_at trigger
CREATE TRIGGER update_viva_payments_updated_at
BEFORE UPDATE ON public.viva_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();