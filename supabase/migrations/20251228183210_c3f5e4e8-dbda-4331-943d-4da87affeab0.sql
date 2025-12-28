-- Create storage bucket for bank logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-logos', 'bank-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload bank logos
CREATE POLICY "Admin can upload bank logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'bank-logos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Allow admins to update bank logos
CREATE POLICY "Admin can update bank logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'bank-logos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Allow admins to delete bank logos
CREATE POLICY "Admin can delete bank logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'bank-logos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Allow public read access to bank logos (for PDFs)
CREATE POLICY "Public can view bank logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'bank-logos');