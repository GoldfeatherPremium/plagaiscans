
-- Add currency column to stripe_payments
ALTER TABLE public.stripe_payments ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- Add currency column to paddle_payments  
ALTER TABLE public.paddle_payments ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

-- Add currency column to manual_payments
ALTER TABLE public.manual_payments ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
