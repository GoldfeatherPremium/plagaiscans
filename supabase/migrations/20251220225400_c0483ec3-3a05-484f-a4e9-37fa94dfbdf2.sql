-- Add magic_link_id column to documents table for guest uploads
ALTER TABLE public.documents 
ADD COLUMN magic_link_id uuid REFERENCES public.magic_upload_links(id) ON DELETE SET NULL;

-- Make user_id nullable for guest uploads
ALTER TABLE public.documents 
ALTER COLUMN user_id DROP NOT NULL;

-- Add RLS policy for anyone to insert documents via magic link
CREATE POLICY "Anyone can insert documents via magic link" 
ON public.documents 
FOR INSERT 
WITH CHECK (magic_link_id IS NOT NULL);

-- Add RLS policy for staff to view magic link documents
-- (already covered by existing staff view policy)