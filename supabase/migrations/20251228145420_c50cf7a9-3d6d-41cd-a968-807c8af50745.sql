-- Create stripe_webhook_logs table to store all webhook events
CREATE TABLE public.stripe_webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.stripe_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook logs
CREATE POLICY "Admin can view webhook logs" 
ON public.stripe_webhook_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert webhook logs (no auth required for webhooks)
CREATE POLICY "System can insert webhook logs" 
ON public.stripe_webhook_logs 
FOR INSERT 
WITH CHECK (true);

-- System can update webhook logs
CREATE POLICY "System can update webhook logs" 
ON public.stripe_webhook_logs 
FOR UPDATE 
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_stripe_webhook_logs_event_type ON public.stripe_webhook_logs(event_type);
CREATE INDEX idx_stripe_webhook_logs_received_at ON public.stripe_webhook_logs(received_at DESC);

-- Create stripe_payments table for customer receipts
CREATE TABLE public.stripe_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  payment_intent_id TEXT,
  amount_usd NUMERIC NOT NULL,
  credits INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  customer_email TEXT,
  receipt_url TEXT,
  invoice_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.stripe_payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "Users can view own stripe payments" 
ON public.stripe_payments 
FOR SELECT 
USING (user_id = auth.uid());

-- Admins can view all payments
CREATE POLICY "Admin can view all stripe payments" 
ON public.stripe_payments 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert payments
CREATE POLICY "System can insert stripe payments" 
ON public.stripe_payments 
FOR INSERT 
WITH CHECK (true);

-- System can update payments
CREATE POLICY "System can update stripe payments" 
ON public.stripe_payments 
FOR UPDATE 
USING (true);

-- Create indexes
CREATE INDEX idx_stripe_payments_user_id ON public.stripe_payments(user_id);
CREATE INDEX idx_stripe_payments_created_at ON public.stripe_payments(created_at DESC);
CREATE INDEX idx_stripe_payments_status ON public.stripe_payments(status);