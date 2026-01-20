-- Add assigned scan types column to staff_settings
ALTER TABLE public.staff_settings 
ADD COLUMN IF NOT EXISTS assigned_scan_types TEXT[] DEFAULT ARRAY['full', 'similarity_only'];

-- Update existing rows to have both scan types by default
UPDATE public.staff_settings 
SET assigned_scan_types = ARRAY['full', 'similarity_only']
WHERE assigned_scan_types IS NULL;