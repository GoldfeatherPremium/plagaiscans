ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS exclude_citations boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclude_small_matches_words integer NOT NULL DEFAULT 0;