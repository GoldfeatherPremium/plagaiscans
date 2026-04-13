-- Add is_special column to magic_upload_links
ALTER TABLE public.magic_upload_links ADD COLUMN is_special boolean NOT NULL DEFAULT false;

-- Update pricing_packages anonymous SELECT policy to allow viewing all active packages
-- (guest page will filter client-side based on link's is_special status)
DROP POLICY IF EXISTS "Anonymous can view active packages" ON public.pricing_packages;
CREATE POLICY "Anonymous can view active packages"
ON public.pricing_packages
FOR SELECT
TO anon
USING (is_active = true);