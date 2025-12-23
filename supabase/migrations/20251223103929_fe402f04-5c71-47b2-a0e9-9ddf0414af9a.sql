-- Add a new RLS policy for reports bucket that allows customers to download 
-- reports that are linked to their documents (via similarity_report_path or ai_report_path)

-- First, drop the existing policy if it exists
DROP POLICY IF EXISTS "Users can view own reports" ON storage.objects;

-- Create a more comprehensive policy that covers both direct folder-based access
-- AND document-based access (for bulk uploaded reports)
CREATE POLICY "Users can view reports linked to their documents" 
ON storage.objects 
FOR SELECT 
TO authenticated
USING (
  bucket_id = 'reports' AND (
    -- Original folder-based access (for manually uploaded reports organized by user_id)
    (auth.uid())::text = (storage.foldername(name))[1]
    OR
    -- Staff and admin can access all reports
    has_role(auth.uid(), 'staff'::app_role)
    OR
    has_role(auth.uid(), 'admin'::app_role)
    OR
    -- Document-based access: allow if the report is linked to a document the user owns
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.user_id = auth.uid()
      AND (d.similarity_report_path = name OR d.ai_report_path = name)
    )
  )
);