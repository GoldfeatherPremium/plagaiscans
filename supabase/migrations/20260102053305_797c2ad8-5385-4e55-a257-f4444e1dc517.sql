-- Add UPDATE policy for staff/admin to update reports in reports bucket
CREATE POLICY "Staff can update reports"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'reports' 
  AND (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  bucket_id = 'reports'
  AND (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);