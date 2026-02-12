
-- Paddle Payments table
CREATE TABLE public.paddle_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  transaction_id TEXT NOT NULL,
  paddle_customer_id TEXT,
  amount_usd NUMERIC NOT NULL,
  credits INTEGER NOT NULL,
  credit_type TEXT NOT NULL DEFAULT 'full',
  status TEXT NOT NULL DEFAULT 'pending',
  customer_email TEXT,
  receipt_url TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.paddle_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own paddle payments" ON public.paddle_payments FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admin can view all paddle payments" ON public.paddle_payments FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage paddle payments" ON public.paddle_payments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "System can insert paddle payments" ON public.paddle_payments FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update paddle payments" ON public.paddle_payments FOR UPDATE USING (true);

-- Paddle Subscriptions table
CREATE TABLE public.paddle_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id TEXT NOT NULL UNIQUE,
  paddle_customer_id TEXT,
  product_id TEXT,
  price_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.paddle_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own paddle subscriptions" ON public.paddle_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Admin can view all paddle subscriptions" ON public.paddle_subscriptions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage paddle subscriptions" ON public.paddle_subscriptions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "System can insert paddle subscriptions" ON public.paddle_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update paddle subscriptions" ON public.paddle_subscriptions FOR UPDATE USING (true);

-- Paddle Webhook Logs table
CREATE TABLE public.paddle_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.paddle_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view paddle webhook logs" ON public.paddle_webhook_logs FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "System can insert paddle webhook logs" ON public.paddle_webhook_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update paddle webhook logs" ON public.paddle_webhook_logs FOR UPDATE USING (true);

-- Add paddle_price_id to pricing_packages
ALTER TABLE public.pricing_packages ADD COLUMN IF NOT EXISTS paddle_price_id TEXT;

-- Add Paddle settings
INSERT INTO public.site_content (content_key, content_value, section, description) VALUES
  ('payment_paddle_enabled', 'false', 'payments', 'Enable/disable Paddle payment method'),
  ('fee_paddle', '0', 'payments', 'Paddle handling fee percentage'),
  ('paddle_environment', 'sandbox', 'payments', 'Paddle environment: sandbox or production'),
  ('paddle_client_token', '', 'payments', 'Paddle client-side token for Paddle.js')
ON CONFLICT DO NOTHING;
