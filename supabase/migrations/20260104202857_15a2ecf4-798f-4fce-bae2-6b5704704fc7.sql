-- Add Dodo Product ID column to pricing_packages table
ALTER TABLE public.pricing_packages 
ADD COLUMN IF NOT EXISTS dodo_product_id text DEFAULT NULL;