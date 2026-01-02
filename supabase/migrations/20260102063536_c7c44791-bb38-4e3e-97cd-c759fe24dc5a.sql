-- Add SELECT policy for staff to view files in magic-uploads bucket
CREATE POLICY "Staff can view magic-uploads"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'magic-uploads' 
  AND has_role(auth.uid(), 'staff'::app_role)
);