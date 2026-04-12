
-- Add is_special to profiles
ALTER TABLE public.profiles ADD COLUMN is_special boolean NOT NULL DEFAULT false;

-- Add is_special to pricing_packages
ALTER TABLE public.pricing_packages ADD COLUMN is_special boolean NOT NULL DEFAULT false;

-- Create a security definer function to check if user is special
CREATE OR REPLACE FUNCTION public.is_special_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_special FROM public.profiles WHERE id = _user_id),
    false
  )
$$;

-- Drop the existing public view policy on pricing_packages
DROP POLICY IF EXISTS "Everyone can view active packages" ON public.pricing_packages;

-- Admin can see all packages
CREATE POLICY "Admin can view all packages"
ON public.pricing_packages
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users see packages matching their special status
CREATE POLICY "Users see matching packages"
ON public.pricing_packages
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND is_special = public.is_special_user(auth.uid())
);

-- Anonymous users see only non-special active packages
CREATE POLICY "Anon can view normal active packages"
ON public.pricing_packages
FOR SELECT
TO anon
USING (is_active = true AND is_special = false);
