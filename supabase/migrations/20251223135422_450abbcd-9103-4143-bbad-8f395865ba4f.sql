-- FIX: Allow guests to view their magic link uploaded files and documents

-- Allow SELECT on magic_upload_files for guests who have the magic link token
-- They can view files where the associated magic_link is active
CREATE POLICY "Anyone can view files via active magic link"
ON magic_upload_files
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM magic_upload_links
    WHERE magic_upload_links.id = magic_upload_files.magic_link_id
    AND magic_upload_links.status = 'active'
    AND (magic_upload_links.expires_at IS NULL OR magic_upload_links.expires_at > now())
  )
);

-- Allow guests to view documents uploaded via magic link
-- Documents with a magic_link_id can be viewed if the link is active
CREATE POLICY "Anyone can view documents via active magic link"
ON documents
FOR SELECT
USING (
  magic_link_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM magic_upload_links
    WHERE magic_upload_links.id = documents.magic_link_id
    AND magic_upload_links.status = 'active'
    AND (magic_upload_links.expires_at IS NULL OR magic_upload_links.expires_at > now())
  )
);