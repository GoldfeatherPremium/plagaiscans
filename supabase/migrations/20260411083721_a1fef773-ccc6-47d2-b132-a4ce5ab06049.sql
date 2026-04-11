
CREATE POLICY "Admin can manage all document tag assignments"
ON public.document_tag_assignments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
