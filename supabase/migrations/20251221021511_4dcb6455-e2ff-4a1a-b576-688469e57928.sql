-- Create table for crypto payments
CREATE TABLE public.crypto_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  payment_id TEXT NOT NULL UNIQUE,
  order_id TEXT,
  credits INTEGER NOT NULL,
  amount_usd NUMERIC NOT NULL,
  pay_amount NUMERIC,
  pay_currency TEXT DEFAULT 'USDTTRC20',
  pay_address TEXT,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crypto_payments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own payments" ON public.crypto_payments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admin can view all payments" ON public.crypto_payments
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can manage payments" ON public.crypto_payments
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert payments" ON public.crypto_payments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update payments" ON public.crypto_payments
  FOR UPDATE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_crypto_payments_updated_at
  BEFORE UPDATE ON public.crypto_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();