-- Create table for tracking transactional email deliveries
CREATE TABLE IF NOT EXISTS public.transactional_email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_type TEXT NOT NULL, -- 'document_completion', 'welcome', 'password_reset', etc.
  recipient_id UUID, -- user_id if applicable
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  document_id UUID, -- for document-related emails
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'skipped'
  provider_response JSONB, -- response from SendPulse
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB -- additional context like file_name, percentages, etc.
);

-- Enable RLS
ALTER TABLE public.transactional_email_logs ENABLE ROW LEVEL SECURITY;

-- Admin can view all logs
CREATE POLICY "Admin can view all email logs"
ON public.transactional_email_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert logs
CREATE POLICY "System can insert email logs"
ON public.transactional_email_logs
FOR INSERT
WITH CHECK (true);

-- System can update logs
CREATE POLICY "System can update email logs"
ON public.transactional_email_logs
FOR UPDATE
USING (true);

-- Create index for faster queries
CREATE INDEX idx_transactional_email_logs_type ON public.transactional_email_logs(email_type);
CREATE INDEX idx_transactional_email_logs_status ON public.transactional_email_logs(status);
CREATE INDEX idx_transactional_email_logs_created_at ON public.transactional_email_logs(created_at DESC);