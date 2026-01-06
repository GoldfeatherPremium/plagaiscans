-- Create table to track customer-deleted documents for admin visibility
CREATE TABLE public.deleted_documents_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_document_id UUID NOT NULL,
  user_id UUID,
  magic_link_id UUID,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  scan_type TEXT NOT NULL DEFAULT 'full',
  similarity_percentage NUMERIC,
  ai_percentage NUMERIC,
  similarity_report_path TEXT,
  ai_report_path TEXT,
  remarks TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_by_type TEXT NOT NULL DEFAULT 'customer', -- 'customer' or 'guest'
  customer_email TEXT,
  customer_name TEXT
);

-- Enable RLS
ALTER TABLE public.deleted_documents_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view deleted documents log
CREATE POLICY "Admins can view deleted documents log"
  ON public.deleted_documents_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Anyone can insert (customers/guests deleting their own docs)
CREATE POLICY "Anyone can insert into deleted documents log"
  ON public.deleted_documents_log
  FOR INSERT
  WITH CHECK (true);

-- Add index for faster queries
CREATE INDEX idx_deleted_documents_log_deleted_at ON public.deleted_documents_log(deleted_at DESC);
CREATE INDEX idx_deleted_documents_log_user_id ON public.deleted_documents_log(user_id);