-- Add soft delete columns for preserving deleted document records
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS deleted_by_user BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add similar columns to magic_upload_files for consistency
ALTER TABLE public.magic_upload_files
ADD COLUMN IF NOT EXISTS deleted_by_user BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create an index for filtering non-deleted documents
CREATE INDEX IF NOT EXISTS idx_documents_deleted_by_user ON public.documents(deleted_by_user);
CREATE INDEX IF NOT EXISTS idx_magic_upload_files_deleted_by_user ON public.magic_upload_files(deleted_by_user);