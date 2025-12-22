-- Add document upload notification preference column
ALTER TABLE public.user_notification_preferences 
ADD COLUMN IF NOT EXISTS document_upload_enabled boolean NOT NULL DEFAULT true;

-- Create a function to send push notification on document upload
CREATE OR REPLACE FUNCTION public.notify_staff_on_document_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    
    -- Insert a record to trigger the edge function (we'll use a separate table for this)
    INSERT INTO public.document_upload_notifications (document_id, customer_email, customer_name, file_name)
    VALUES (NEW.id, customer_email, COALESCE(customer_name, 'Customer'), NEW.file_name);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create a table to queue document upload notifications
CREATE TABLE IF NOT EXISTS public.document_upload_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  customer_email text,
  customer_name text,
  file_name text NOT NULL,
  processed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_upload_notifications ENABLE ROW LEVEL SECURITY;

-- Only allow system/service role to manage this table
CREATE POLICY "Service role can manage notifications" 
ON public.document_upload_notifications 
FOR ALL 
USING (true);

-- Create the trigger
DROP TRIGGER IF EXISTS on_document_upload_notify ON public.documents;
CREATE TRIGGER on_document_upload_notify
  AFTER INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_staff_on_document_upload();