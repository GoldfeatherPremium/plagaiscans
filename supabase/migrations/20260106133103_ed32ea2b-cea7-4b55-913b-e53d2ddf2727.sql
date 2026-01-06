-- Create queue status enum
CREATE TYPE public.similarity_queue_status AS ENUM ('queued', 'processing', 'completed', 'failed');

-- Create similarity_queue table
CREATE TABLE public.similarity_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_filename TEXT NOT NULL,
  normalized_filename TEXT NOT NULL,
  report_path TEXT NOT NULL,
  similarity_percentage NUMERIC,
  queue_status public.similarity_queue_status NOT NULL DEFAULT 'queued',
  needs_review BOOLEAN DEFAULT false,
  review_reason TEXT,
  processed_at TIMESTAMPTZ,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.similarity_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin/staff only
CREATE POLICY "Admin and staff can view all queue items"
ON public.similarity_queue FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'staff')
  )
);

CREATE POLICY "Admin and staff can insert queue items"
ON public.similarity_queue FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'staff')
  )
);

CREATE POLICY "Admin and staff can update queue items"
ON public.similarity_queue FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'staff')
  )
);

CREATE POLICY "Admin can delete queue items"
ON public.similarity_queue FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Create similarity-reports storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('similarity-reports', 'similarity-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for similarity-reports bucket
CREATE POLICY "Admin and staff can upload similarity reports"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'similarity-reports'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'staff')
  )
);

CREATE POLICY "Admin and staff can view similarity reports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'similarity-reports'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'staff')
  )
);

CREATE POLICY "Admin can delete similarity reports"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'similarity-reports'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Add index for faster queries
CREATE INDEX idx_similarity_queue_status ON public.similarity_queue(queue_status);
CREATE INDEX idx_similarity_queue_uploaded_at ON public.similarity_queue(uploaded_at DESC);