-- Allow anyone to read the google_oauth_enabled setting (needed for auth page)
CREATE POLICY "Anyone can view google oauth setting" 
ON public.settings 
FOR SELECT 
USING (key = 'google_oauth_enabled');