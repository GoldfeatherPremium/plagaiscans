-- Add column to track when files were cleaned from storage
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS files_cleaned_at TIMESTAMPTZ;

-- Add index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS idx_documents_cleanup 
ON public.documents (uploaded_at, files_cleaned_at) 
WHERE files_cleaned_at IS NULL;