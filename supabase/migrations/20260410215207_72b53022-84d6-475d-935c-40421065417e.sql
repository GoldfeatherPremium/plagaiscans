
CREATE TABLE public.humanizer_usage_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NULL,
  word_count integer NOT NULL,
  mode text NOT NULL DEFAULT 'standard',
  increase_human_score boolean NOT NULL DEFAULT false,
  estimated_score integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.humanizer_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert humanizer logs"
ON public.humanizer_usage_logs
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Admins can view humanizer logs"
ON public.humanizer_usage_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_humanizer_usage_created_at ON public.humanizer_usage_logs (created_at DESC);
CREATE INDEX idx_humanizer_usage_user_id ON public.humanizer_usage_logs (user_id);
