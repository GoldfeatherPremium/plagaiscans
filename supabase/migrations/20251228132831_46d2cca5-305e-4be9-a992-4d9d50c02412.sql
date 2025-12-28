-- Create table to track credit validity for time-limited packages
CREATE TABLE public.credit_validity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  credits_amount INTEGER NOT NULL,
  remaining_credits INTEGER NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  package_id UUID REFERENCES public.pricing_packages(id),
  transaction_id UUID REFERENCES public.credit_transactions(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expired BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.credit_validity ENABLE ROW LEVEL SECURITY;

-- Users can view own credit validity
CREATE POLICY "Users can view own credit validity"
ON public.credit_validity
FOR SELECT
USING (user_id = auth.uid());

-- Admin can view all credit validity
CREATE POLICY "Admin can view all credit validity"
ON public.credit_validity
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert credit validity
CREATE POLICY "System can insert credit validity"
ON public.credit_validity
FOR INSERT
WITH CHECK (true);

-- System can update credit validity
CREATE POLICY "System can update credit validity"
ON public.credit_validity
FOR UPDATE
USING (true);

-- Create index for expiration queries
CREATE INDEX idx_credit_validity_expires_at ON public.credit_validity(expires_at) WHERE NOT expired;