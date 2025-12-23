-- Add normalized_filename column to documents table for auto-mapping
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS normalized_filename text;

-- Add needs_review status for documents with mapping conflicts
-- Note: We'll use a separate column since document_status is an enum
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;

-- Add review_reason for tracking why a document needs manual review
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS review_reason text;

-- Create index for faster lookups by normalized_filename
CREATE INDEX IF NOT EXISTS idx_documents_normalized_filename 
ON public.documents(normalized_filename);

-- Create a function to normalize filenames
CREATE OR REPLACE FUNCTION public.normalize_filename(filename text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result text;
BEGIN
  -- Convert to lowercase
  result := lower(filename);
  
  -- Remove file extension
  result := regexp_replace(result, '\.[^.]+$', '');
  
  -- Remove trailing counters like (1), (2), etc.
  result := regexp_replace(result, '\s*\(\d+\)\s*$', '');
  
  -- Trim whitespace
  result := trim(result);
  
  RETURN result;
END;
$$;

-- Create trigger to auto-populate normalized_filename on insert/update
CREATE OR REPLACE FUNCTION public.set_normalized_filename()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.normalized_filename := public.normalize_filename(NEW.file_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_normalized_filename_trigger ON public.documents;
CREATE TRIGGER set_normalized_filename_trigger
  BEFORE INSERT OR UPDATE OF file_name ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_normalized_filename();

-- Update existing documents to have normalized_filename
UPDATE public.documents 
SET normalized_filename = public.normalize_filename(file_name)
WHERE normalized_filename IS NULL;

-- Create unmatched_reports table for reports that couldn't be auto-mapped
CREATE TABLE IF NOT EXISTS public.unmatched_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  normalized_filename text NOT NULL,
  file_path text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  uploaded_at timestamptz DEFAULT now(),
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  matched_document_id uuid REFERENCES public.documents(id),
  report_type text CHECK (report_type IN ('similarity', 'ai'))
);

-- Enable RLS on unmatched_reports
ALTER TABLE public.unmatched_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for unmatched_reports
CREATE POLICY "Admin can manage unmatched reports"
ON public.unmatched_reports
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view unmatched reports"
ON public.unmatched_reports
FOR SELECT
USING (has_role(auth.uid(), 'staff'));

CREATE POLICY "Staff can insert unmatched reports"
ON public.unmatched_reports
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'staff') OR has_role(auth.uid(), 'admin'));