-- Allow guests to delete documents they uploaded via magic link
CREATE POLICY "Guests can delete documents via active magic link" 
ON public.documents 
FOR DELETE 
USING (
  magic_link_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM magic_upload_links 
    WHERE magic_upload_links.id = documents.magic_link_id 
    AND magic_upload_links.status = 'active'
    AND (magic_upload_links.expires_at IS NULL OR magic_upload_links.expires_at > now())
  )
);