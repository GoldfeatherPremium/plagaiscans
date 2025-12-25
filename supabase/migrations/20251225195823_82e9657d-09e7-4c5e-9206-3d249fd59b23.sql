-- Add email_unsubscribed field to profiles table for marketing emails opt-out
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_unsubscribed boolean DEFAULT false;

-- Create index for quick lookups when sending emails
CREATE INDEX IF NOT EXISTS idx_profiles_email_unsubscribed ON public.profiles(email_unsubscribed);

-- Create email_send_logs table for individual email tracking (privacy-safe)
CREATE TABLE IF NOT EXISTS public.email_send_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_log_id uuid REFERENCES public.email_logs(id) ON DELETE SET NULL,
  recipient_id uuid NOT NULL,
  sent_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'sent',
  error_message text
);

-- Enable RLS on email_send_logs
ALTER TABLE public.email_send_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view email send logs (no recipient emails exposed)
CREATE POLICY "Admins can view email send logs" ON public.email_send_logs
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_send_logs_email_log_id ON public.email_send_logs(email_log_id);
CREATE INDEX IF NOT EXISTS idx_email_send_logs_recipient_id ON public.email_send_logs(recipient_id);