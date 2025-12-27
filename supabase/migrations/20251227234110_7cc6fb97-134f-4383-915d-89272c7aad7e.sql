-- Allow anonymous/public contact form submissions to support_tickets
CREATE POLICY "Allow public contact form submissions"
ON public.support_tickets
FOR INSERT
WITH CHECK (user_id = '00000000-0000-0000-0000-000000000000'::uuid);