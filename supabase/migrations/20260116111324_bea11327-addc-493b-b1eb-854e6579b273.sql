-- Create PayPal payments table
CREATE TABLE public.paypal_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  order_id TEXT UNIQUE NOT NULL,
  payment_id TEXT,
  amount_usd DECIMAL(10,2) NOT NULL,
  credits INTEGER NOT NULL,
  credit_type TEXT DEFAULT 'full',
  status TEXT DEFAULT 'pending',
  customer_email TEXT,
  payer_id TEXT,
  payer_email TEXT,
  receipt_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create PayPal webhook logs table
CREATE TABLE public.paypal_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on both tables
ALTER TABLE public.paypal_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paypal_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Policies for paypal_payments
CREATE POLICY "Users can view own PayPal payments" 
  ON public.paypal_payments FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all PayPal payments"
  ON public.paypal_payments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Service role can manage all PayPal payments"
  ON public.paypal_payments FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policies for paypal_webhook_logs (admin only)
CREATE POLICY "Admins can view PayPal webhook logs"
  ON public.paypal_webhook_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage webhook logs"
  ON public.paypal_webhook_logs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger for paypal_payments
CREATE TRIGGER update_paypal_payments_updated_at
  BEFORE UPDATE ON public.paypal_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_paypal_payments_user_id ON public.paypal_payments(user_id);
CREATE INDEX idx_paypal_payments_order_id ON public.paypal_payments(order_id);
CREATE INDEX idx_paypal_payments_status ON public.paypal_payments(status);
CREATE INDEX idx_paypal_payments_created_at ON public.paypal_payments(created_at DESC);
CREATE INDEX idx_paypal_webhook_logs_event_id ON public.paypal_webhook_logs(event_id);
CREATE INDEX idx_paypal_webhook_logs_event_type ON public.paypal_webhook_logs(event_type);