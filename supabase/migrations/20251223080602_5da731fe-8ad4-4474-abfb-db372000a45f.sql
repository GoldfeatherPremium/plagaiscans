-- Create push_notification_logs table for audit trail
CREATE TABLE public.push_notification_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_audience TEXT NOT NULL DEFAULT 'all',
  target_user_id UUID,
  sent_by UUID,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.push_notification_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admin can view all push notification logs"
ON public.push_notification_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert push notification logs"
ON public.push_notification_logs
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update push notification logs"
ON public.push_notification_logs
FOR UPDATE
USING (true);

-- Insert global notification toggle settings (if they don't exist)
INSERT INTO public.settings (key, value) 
VALUES 
  ('push_notifications_enabled', 'true'),
  ('push_customer_notifications_enabled', 'true'),
  ('push_admin_notifications_enabled', 'true'),
  ('push_staff_notifications_enabled', 'true'),
  ('push_document_upload_notifications_enabled', 'true')
ON CONFLICT (key) DO NOTHING;