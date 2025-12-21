-- Allow public access to reports for magic link documents
-- This enables guests using magic links to download their processed reports

CREATE POLICY "Public can view reports for magic link documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'reports'
  AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.magic_link_id IS NOT NULL
    AND (
      d.similarity_report_path = name
      OR d.ai_report_path = name
    )
  )
);