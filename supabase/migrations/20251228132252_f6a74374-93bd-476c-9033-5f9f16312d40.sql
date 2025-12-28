-- Add new columns to pricing_packages for package type, billing interval, and validity
ALTER TABLE public.pricing_packages 
ADD COLUMN IF NOT EXISTS package_type text NOT NULL DEFAULT 'one_time',
ADD COLUMN IF NOT EXISTS billing_interval text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS validity_days integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS stripe_price_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS stripe_product_id text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS name text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS description text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS features text[] DEFAULT '{}';

-- Add a check constraint for package_type
ALTER TABLE public.pricing_packages 
ADD CONSTRAINT valid_package_type CHECK (package_type IN ('one_time', 'subscription', 'time_limited'));

-- Add a check constraint for billing_interval (only for subscriptions)
ALTER TABLE public.pricing_packages 
ADD CONSTRAINT valid_billing_interval CHECK (
  (package_type = 'subscription' AND billing_interval IN ('day', 'week', 'month', 'year')) 
  OR (package_type != 'subscription' AND billing_interval IS NULL)
);

-- Update existing packages to have a default name
UPDATE public.pricing_packages 
SET name = credits || ' Credits Pack' 
WHERE name IS NULL;