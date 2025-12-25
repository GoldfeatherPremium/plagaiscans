-- Add percentage columns to unmatched_reports table
ALTER TABLE public.unmatched_reports 
ADD COLUMN IF NOT EXISTS similarity_percentage numeric NULL,
ADD COLUMN IF NOT EXISTS ai_percentage numeric NULL;