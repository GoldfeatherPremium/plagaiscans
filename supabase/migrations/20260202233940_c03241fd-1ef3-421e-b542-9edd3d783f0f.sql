-- Create stripe_refunds table
CREATE TABLE public.stripe_refunds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  payment_intent_id TEXT NOT NULL,
  refund_id TEXT UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL,
  credits_deducted INTEGER DEFAULT 0,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Create stripe_disputes table
CREATE TABLE public.stripe_disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  charge_id TEXT NOT NULL,
  dispute_id TEXT UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'open',
  evidence_due_by TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Create stripe_rate_limits table
CREATE TABLE public.stripe_rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for rate limit queries
CREATE INDEX idx_stripe_rate_limits_user_action_time 
ON public.stripe_rate_limits(user_id, action, created_at DESC);

-- Create index for refunds lookup
CREATE INDEX idx_stripe_refunds_payment_intent 
ON public.stripe_refunds(payment_intent_id);

-- Create index for disputes lookup
CREATE INDEX idx_stripe_disputes_charge 
ON public.stripe_disputes(charge_id);

-- Enable RLS on all tables
ALTER TABLE public.stripe_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS policies for stripe_refunds
CREATE POLICY "Users can view their own refunds"
ON public.stripe_refunds FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all refunds"
ON public.stripe_refunds FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert refunds"
ON public.stripe_refunds FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update refunds"
ON public.stripe_refunds FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for stripe_disputes
CREATE POLICY "Users can view their own disputes"
ON public.stripe_disputes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all disputes"
ON public.stripe_disputes FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage disputes"
ON public.stripe_disputes FOR ALL
USING (true)
WITH CHECK (true);

-- RLS policies for stripe_rate_limits
CREATE POLICY "Users can view their own rate limits"
ON public.stripe_rate_limits FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rate limits"
ON public.stripe_rate_limits FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add stripe_refunds to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.stripe_refunds;

-- Add stripe_disputes to realtime  
ALTER PUBLICATION supabase_realtime ADD TABLE public.stripe_disputes;