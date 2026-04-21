-- Sample document settings (key/value rows in existing settings table)
INSERT INTO public.settings (key, value) VALUES
  ('sample_enabled', 'false'),
  ('sample_file_name', 'Sample.docx'),
  ('sample_file_path', ''),
  ('sample_sim_path', ''),
  ('sample_ai_path', ''),
  ('sample_sim_percentage', '12'),
  ('sample_ai_percentage', '18'),
  ('sample_remarks', '')
ON CONFLICT (key) DO NOTHING;

-- Allow any authenticated user to read sample reports + sample document
CREATE POLICY "Authenticated can read sample reports"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'reports' AND (storage.foldername(name))[1] = 'sample');

CREATE POLICY "Authenticated can read sample documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'sample');

-- Allow admins to manage sample files in both buckets
CREATE POLICY "Admin can upload sample reports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reports' AND (storage.foldername(name))[1] = 'sample' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update sample reports"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'reports' AND (storage.foldername(name))[1] = 'sample' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete sample reports"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'reports' AND (storage.foldername(name))[1] = 'sample' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can upload sample documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'sample' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can update sample documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'sample' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete sample documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = 'sample' AND has_role(auth.uid(), 'admin'::app_role));