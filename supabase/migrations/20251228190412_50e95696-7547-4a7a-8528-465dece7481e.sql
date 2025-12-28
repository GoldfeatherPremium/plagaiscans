-- Add transaction_id column to bank_statement_entries if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bank_statement_entries' 
    AND column_name = 'transaction_id'
  ) THEN
    ALTER TABLE public.bank_statement_entries 
    ADD COLUMN transaction_id TEXT;
  END IF;
END $$;

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bank_statement_entries_transaction_id 
ON public.bank_statement_entries(transaction_id);

-- Add entry_time column if it doesn't exist (for more granular timestamps)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'bank_statement_entries' 
    AND column_name = 'entry_time'
  ) THEN
    ALTER TABLE public.bank_statement_entries 
    ADD COLUMN entry_time TIME;
  END IF;
END $$;