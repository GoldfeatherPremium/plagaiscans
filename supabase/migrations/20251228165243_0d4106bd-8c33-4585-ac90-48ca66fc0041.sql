-- Create bank_statements table
CREATE TABLE public.bank_statements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  statement_number TEXT NOT NULL UNIQUE,
  bank_name TEXT NOT NULL DEFAULT 'Default Bank',
  bank_country TEXT NOT NULL DEFAULT 'United Kingdom',
  bank_logo_url TEXT,
  account_name TEXT NOT NULL DEFAULT 'Goldfeather Prem Ltd',
  account_number TEXT,
  sort_code TEXT,
  iban TEXT,
  swift_code TEXT,
  statement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_credits NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_debits NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GBP',
  notes TEXT,
  pdf_path TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bank_statement_entries table for individual transactions
CREATE TABLE public.bank_statement_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  statement_id UUID NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  entry_type TEXT NOT NULL DEFAULT 'credit', -- 'credit' or 'debit'
  amount NUMERIC(12,2) NOT NULL,
  running_balance NUMERIC(12,2),
  invoice_id UUID REFERENCES public.invoices(id),
  receipt_id UUID REFERENCES public.receipts(id),
  is_manual BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statement_entries ENABLE ROW LEVEL SECURITY;

-- RLS policies for bank_statements
CREATE POLICY "Admin can manage bank statements" 
ON public.bank_statements 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for bank_statement_entries
CREATE POLICY "Admin can manage bank statement entries" 
ON public.bank_statement_entries 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to generate statement number
CREATE OR REPLACE FUNCTION public.generate_statement_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(
    CASE 
      WHEN statement_number ~ ('^STM-' || year_part || '-[0-9]+$')
      THEN (REGEXP_REPLACE(statement_number, '^STM-' || year_part || '-', ''))::INTEGER
      ELSE 0
    END
  ), 0) + 1
  INTO seq_num
  FROM public.bank_statements;
  
  NEW.statement_number := 'STM-' || year_part || '-' || LPAD(seq_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for auto-generating statement number
CREATE TRIGGER generate_statement_number_trigger
BEFORE INSERT ON public.bank_statements
FOR EACH ROW
WHEN (NEW.statement_number IS NULL OR NEW.statement_number = '')
EXECUTE FUNCTION public.generate_statement_number();

-- Update trigger for updated_at
CREATE TRIGGER update_bank_statements_updated_at
BEFORE UPDATE ON public.bank_statements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_bank_statements_period ON public.bank_statements(period_start, period_end);
CREATE INDEX idx_bank_statement_entries_statement_id ON public.bank_statement_entries(statement_id);
CREATE INDEX idx_bank_statement_entries_entry_date ON public.bank_statement_entries(entry_date);