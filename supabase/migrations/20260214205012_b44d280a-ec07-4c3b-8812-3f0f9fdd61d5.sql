
-- Add exclusion option columns to documents table
ALTER TABLE public.documents 
  ADD COLUMN IF NOT EXISTS exclude_bibliography boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exclude_quotes boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclude_small_sources boolean NOT NULL DEFAULT false;
