ALTER TABLE public.reseller_scans 
  ADD COLUMN IF NOT EXISTS similarity_percentage numeric,
  ADD COLUMN IF NOT EXISTS similarity_report_path text;