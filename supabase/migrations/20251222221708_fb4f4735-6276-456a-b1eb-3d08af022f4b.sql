-- Allow staff to view all profiles (for document queue customer names)
CREATE POLICY "Staff can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'staff'::app_role));