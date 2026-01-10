-- Add scan_type column to document_upload_notifications table
ALTER TABLE public.document_upload_notifications 
ADD COLUMN IF NOT EXISTS scan_type text DEFAULT 'full';

-- Update the trigger function to include scan_type
CREATE OR REPLACE FUNCTION public.notify_staff_on_document_upload()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  customer_email text;
  customer_name text;
BEGIN
  -- Only trigger for new documents uploaded by customers (not magic links)
  IF NEW.user_id IS NOT NULL THEN
    -- Get customer info
    SELECT email, full_name INTO customer_email, customer_name
    FROM public.profiles
    WHERE id = NEW.user_id;
    
    -- Insert a record to trigger the edge function with scan_type
    INSERT INTO public.document_upload_notifications (document_id, customer_email, customer_name, file_name, scan_type)
    VALUES (NEW.id, customer_email, COALESCE(customer_name, 'Customer'), NEW.file_name, COALESCE(NEW.scan_type, 'full'));
  END IF;
  
  RETURN NEW;
END;
$function$;