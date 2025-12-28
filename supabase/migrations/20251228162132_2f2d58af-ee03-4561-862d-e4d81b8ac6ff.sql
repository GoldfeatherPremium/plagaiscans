-- Create receipts table
CREATE TABLE public.receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id),
  receipt_number TEXT NOT NULL UNIQUE,
  receipt_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  customer_name TEXT,
  customer_email TEXT,
  customer_country TEXT,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC,
  subtotal NUMERIC,
  vat_rate NUMERIC DEFAULT 0,
  vat_amount NUMERIC DEFAULT 0,
  amount_paid NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_method TEXT NOT NULL,
  transaction_id TEXT,
  payment_id TEXT,
  credits INTEGER NOT NULL,
  pdf_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own receipts" ON public.receipts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admin can view all receipts" ON public.receipts
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can insert receipts" ON public.receipts
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert receipts" ON public.receipts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin can update receipts" ON public.receipts
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create receipt number generator
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN receipt_number ~ ('^RCP-' || year_part || '-[0-9]+$')
      THEN (REGEXP_REPLACE(receipt_number, '^RCP-' || year_part || '-', ''))::INTEGER
      ELSE 0
    END
  ), 0) + 1
  INTO seq_num
  FROM public.receipts;
  
  NEW.receipt_number := 'RCP-' || year_part || '-' || LPAD(seq_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

-- Create trigger for receipt number
CREATE TRIGGER set_receipt_number
  BEFORE INSERT ON public.receipts
  FOR EACH ROW
  WHEN (NEW.receipt_number IS NULL OR NEW.receipt_number = '')
  EXECUTE FUNCTION public.generate_receipt_number();

-- Create trigger for updated_at
CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create receipts storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for receipts bucket
CREATE POLICY "Users can view own receipts files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'receipts' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admin can view all receipt files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'receipts' AND 
    has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "System can upload receipt files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'receipts');