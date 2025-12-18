-- Add assigned_at column to track when document was picked
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS assigned_at timestamp with time zone;

-- Insert default processing timeout setting (30 minutes default)
INSERT INTO public.settings (key, value) 
VALUES ('processing_timeout_minutes', '30')
ON CONFLICT (key) DO NOTHING;