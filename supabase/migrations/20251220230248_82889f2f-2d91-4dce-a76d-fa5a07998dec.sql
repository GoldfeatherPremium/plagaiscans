-- Add RLS policy for anyone to view documents via magic link
-- This allows guests to see their document results by magic_link_id
CREATE POLICY "Anyone can view documents via magic link" 
ON public.documents 
FOR SELECT 
USING (magic_link_id IS NOT NULL);