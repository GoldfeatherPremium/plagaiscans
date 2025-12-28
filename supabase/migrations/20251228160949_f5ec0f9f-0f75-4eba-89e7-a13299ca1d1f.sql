-- Add new columns to invoices table for UK compliance
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS customer_country TEXT,
ADD COLUMN IF NOT EXISTS transaction_id TEXT,
ADD COLUMN IF NOT EXISTS subtotal NUMERIC,
ADD COLUMN IF NOT EXISTS vat_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS vat_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit_price NUMERIC,
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS pdf_path TEXT,
ADD COLUMN IF NOT EXISTS is_immutable BOOLEAN DEFAULT false;

-- Update existing invoices to set subtotal and unit_price from amount_usd
UPDATE public.invoices 
SET subtotal = amount_usd, 
    unit_price = amount_usd,
    is_immutable = CASE WHEN status = 'paid' THEN true ELSE false END
WHERE subtotal IS NULL;

-- Create trigger to prevent updates to paid invoices (immutability)
CREATE OR REPLACE FUNCTION public.enforce_invoice_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow only pdf_path updates on immutable invoices
  IF OLD.is_immutable = true THEN
    IF NEW.pdf_path IS DISTINCT FROM OLD.pdf_path THEN
      -- Allow pdf_path update
      NEW := OLD;
      NEW.pdf_path := (SELECT pdf_path FROM (SELECT NEW.pdf_path as pdf_path) t);
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cannot modify an immutable invoice';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS enforce_invoice_immutability_trigger ON public.invoices;

CREATE TRIGGER enforce_invoice_immutability_trigger
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.enforce_invoice_immutability();

-- Create invoices storage bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('invoices', 'invoices', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for invoices bucket
CREATE POLICY "Users can view own invoices" ON storage.objects
FOR SELECT USING (
  bucket_id = 'invoices' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admin can view all invoices" ON storage.objects
FOR SELECT USING (
  bucket_id = 'invoices' 
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "System can insert invoices" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'invoices'
);