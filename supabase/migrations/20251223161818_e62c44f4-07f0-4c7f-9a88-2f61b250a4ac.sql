-- Update the normalize_filename function to only remove extension (for customer documents)
-- Report normalization is handled in the edge function with different logic

CREATE OR REPLACE FUNCTION public.normalize_filename(filename text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  result text;
BEGIN
  -- Convert to lowercase
  result := lower(filename);
  
  -- Remove file extension only - keep all brackets as part of the base name
  result := regexp_replace(result, '\.[^.]+$', '');
  
  -- Trim whitespace
  result := trim(result);
  
  RETURN result;
END;
$function$;

-- Add a comment explaining the normalization strategy
COMMENT ON FUNCTION public.normalize_filename(text) IS 'Normalizes customer document filenames by removing extension only. Brackets like (1) are preserved as part of the base name. Report normalization (removing last trailing suffix) is handled in the bulk-report-upload edge function.';