-- Add suggested_documents column to unmatched_reports for storing fuzzy match suggestions
ALTER TABLE public.unmatched_reports 
ADD COLUMN IF NOT EXISTS suggested_documents JSONB DEFAULT '[]'::jsonb;