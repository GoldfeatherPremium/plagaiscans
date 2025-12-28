-- Update the generate_invoice_number function to start from 00034
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
  min_seq INTEGER := 34; -- Start from 00034
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  
  -- Get the next sequence number for this year
  SELECT COALESCE(MAX(
    CASE 
      WHEN invoice_number ~ ('^INV-' || year_part || '-[0-9]+$')
      THEN (REGEXP_REPLACE(invoice_number, '^INV-' || year_part || '-', ''))::INTEGER
      ELSE 0
    END
  ), min_seq - 1) + 1
  INTO seq_num
  FROM public.invoices;
  
  -- Ensure we never go below min_seq
  IF seq_num < min_seq THEN
    seq_num := min_seq;
  END IF;
  
  NEW.invoice_number := 'INV-' || year_part || '-' || LPAD(seq_num::TEXT, 5, '0');
  RETURN NEW;
END;
$function$;

-- Create function to auto-add invoice to bank statement
CREATE OR REPLACE FUNCTION public.auto_add_invoice_to_bank_statement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  statement_record RECORD;
  entry_date DATE;
  customer_ref TEXT;
BEGIN
  -- Only process paid invoices
  IF NEW.status != 'paid' THEN
    RETURN NEW;
  END IF;
  
  -- Skip if this is an update and status didn't change to paid
  IF TG_OP = 'UPDATE' AND OLD.status = 'paid' THEN
    RETURN NEW;
  END IF;
  
  -- Determine entry date from paid_at or created_at
  entry_date := COALESCE(NEW.paid_at, NEW.created_at)::DATE;
  
  -- Find a bank statement that covers this date
  SELECT * INTO statement_record
  FROM public.bank_statements
  WHERE entry_date BETWEEN period_start AND period_end
  LIMIT 1;
  
  -- If no statement covers this date, skip
  IF statement_record IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if entry already exists for this invoice
  IF EXISTS (
    SELECT 1 FROM public.bank_statement_entries 
    WHERE invoice_id = NEW.id AND statement_id = statement_record.id
  ) THEN
    RETURN NEW;
  END IF;
  
  -- Create customer reference
  customer_ref := COALESCE(NEW.customer_name, 'Customer') || ' - ' || NEW.invoice_number;
  
  -- Add entry to bank statement
  INSERT INTO public.bank_statement_entries (
    statement_id,
    entry_date,
    description,
    amount,
    entry_type,
    reference,
    invoice_id,
    is_manual
  ) VALUES (
    statement_record.id,
    entry_date,
    'Invoice Payment: ' || NEW.invoice_number || ' (' || NEW.credits || ' credits)',
    NEW.amount_usd,
    'credit',
    customer_ref,
    NEW.id,
    false
  );
  
  -- Update statement totals
  UPDATE public.bank_statements
  SET 
    total_credits = total_credits + NEW.amount_usd,
    closing_balance = closing_balance + NEW.amount_usd,
    updated_at = NOW()
  WHERE id = statement_record.id;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for auto-adding invoices to bank statements
DROP TRIGGER IF EXISTS trigger_auto_add_invoice_to_statement ON public.invoices;
CREATE TRIGGER trigger_auto_add_invoice_to_statement
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_invoice_to_bank_statement();