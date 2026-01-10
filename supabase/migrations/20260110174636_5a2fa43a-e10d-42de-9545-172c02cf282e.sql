-- Add RLS policy to allow customers to delete their own documents
CREATE POLICY "Customers can delete own documents"
ON public.documents
FOR DELETE
TO authenticated
USING (user_id = auth.uid());