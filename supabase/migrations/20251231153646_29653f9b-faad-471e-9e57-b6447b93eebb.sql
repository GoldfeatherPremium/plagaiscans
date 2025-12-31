-- Add similarity credit balance to profiles
ALTER TABLE public.profiles 
ADD COLUMN similarity_credit_balance integer NOT NULL DEFAULT 0;

-- Add scan type to documents (full = similarity + AI, similarity_only = just similarity)
ALTER TABLE public.documents 
ADD COLUMN scan_type text NOT NULL DEFAULT 'full' CHECK (scan_type IN ('full', 'similarity_only'));

-- Add credit type to credit_validity for tracking expiration by type
ALTER TABLE public.credit_validity 
ADD COLUMN credit_type text NOT NULL DEFAULT 'full' CHECK (credit_type IN ('full', 'similarity_only'));

-- Add credit type to credit_transactions for tracking which type was used
ALTER TABLE public.credit_transactions 
ADD COLUMN credit_type text NOT NULL DEFAULT 'full' CHECK (credit_type IN ('full', 'similarity_only'));

-- Add credit type to pricing_packages
ALTER TABLE public.pricing_packages 
ADD COLUMN credit_type text NOT NULL DEFAULT 'full' CHECK (credit_type IN ('full', 'similarity_only'));

-- Create index for faster document queue filtering by scan_type
CREATE INDEX idx_documents_scan_type ON public.documents(scan_type);

-- Create index for pricing packages by credit type
CREATE INDEX idx_pricing_packages_credit_type ON public.pricing_packages(credit_type);