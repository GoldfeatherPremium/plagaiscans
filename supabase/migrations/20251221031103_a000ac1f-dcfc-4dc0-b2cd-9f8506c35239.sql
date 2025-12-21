-- Create table for manual payments (Binance Pay, etc.)
CREATE TABLE public.manual_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  payment_method TEXT NOT NULL,
  amount_usd NUMERIC NOT NULL,
  credits INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID,
  notes TEXT
);

-- Enable RLS
ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "Users can view own manual payments"
ON public.manual_payments
FOR SELECT
USING (user_id = auth.uid());

-- Users can create their own payments
CREATE POLICY "Users can create manual payments"
ON public.manual_payments
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Admin can manage all payments
CREATE POLICY "Admin can manage manual payments"
ON public.manual_payments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));