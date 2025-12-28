-- Update the transaction ID generation function to create 22-character alphanumeric IDs
CREATE OR REPLACE FUNCTION public.generate_transaction_id()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  -- Generate 22 character alphanumeric transaction ID
  FOR i IN 1..22 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  
  RETURN result;
END;
$function$;