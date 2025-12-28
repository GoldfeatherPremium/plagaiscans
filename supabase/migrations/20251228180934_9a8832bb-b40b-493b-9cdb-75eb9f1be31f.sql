-- Drop the trigger first, then the function
DROP TRIGGER IF EXISTS generate_statement_number_trigger ON public.bank_statements;
DROP FUNCTION IF EXISTS public.generate_statement_number() CASCADE;

-- Create function to generate random alphanumeric statement number
CREATE OR REPLACE FUNCTION public.generate_statement_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  -- Generate format: STM-XXXXXX (6 random alphanumeric characters)
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  
  NEW.statement_number := 'STM-' || result;
  RETURN NEW;
END;
$function$;

-- Recreate the trigger for auto-generating statement numbers
CREATE TRIGGER generate_statement_number_trigger
  BEFORE INSERT ON public.bank_statements
  FOR EACH ROW
  WHEN (NEW.statement_number IS NULL OR NEW.statement_number = '')
  EXECUTE FUNCTION public.generate_statement_number();