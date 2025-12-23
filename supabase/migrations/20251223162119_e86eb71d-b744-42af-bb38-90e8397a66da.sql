-- Update existing documents to recalculate normalized_filename with the new logic
-- This ensures brackets are preserved in the base name

UPDATE documents
SET normalized_filename = public.normalize_filename(file_name)
WHERE normalized_filename IS NOT NULL;