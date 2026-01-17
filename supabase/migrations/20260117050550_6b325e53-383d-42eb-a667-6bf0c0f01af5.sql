-- Create viva_payments table
CREATE TABLE public.viva_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  order_code TEXT NOT NULL UNIQUE,
  transaction_id TEXT,
  amount_usd NUMERIC(10,2) NOT NULL,
  amount_cents INTEGER NOT NULL,
  credits INTEGER NOT NULL,
  credit_type TEXT DEFAULT 'full',
  status TEXT NOT NULL DEFAULT 'pending',
  customer_email TEXT,
  merchant_trns TEXT,
  source_code TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create viva_webhook_logs table
CREATE TABLE public.viva_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_type_id INTEGER,
  event_type TEXT,
  order_code TEXT,
  transaction_id TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on viva_payments
ALTER TABLE public.viva_payments ENABLE ROW LEVEL SECURITY;

-- Enable RLS on viva_webhook_logs
ALTER TABLE public.viva_webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for viva_payments
CREATE POLICY "Users can view own viva payments" ON public.viva_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all viva payments" ON public.viva_payments
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert viva payments" ON public.viva_payments
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE POLICY "Service role can manage viva payments" ON public.viva_payments
  FOR ALL USING (true);

-- RLS policies for viva_webhook_logs
CREATE POLICY "Admins can view viva webhook logs" ON public.viva_webhook_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage viva webhook logs" ON public.viva_webhook_logs
  FOR ALL USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_viva_payments_updated_at
  BEFORE UPDATE ON public.viva_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert additional Viva settings
INSERT INTO public.settings (key, value) VALUES 
  ('viva_environment', 'demo'),
  ('viva_merchant_id', ''),
  ('viva_webhook_verification_key', '')
ON CONFLICT (key) DO NOTHING;