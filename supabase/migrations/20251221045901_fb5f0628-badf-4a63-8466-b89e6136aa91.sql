-- Add category and targeting to notifications
ALTER TABLE public.notifications 
ADD COLUMN category text NOT NULL DEFAULT 'system' CHECK (category IN ('system', 'promotional', 'updates')),
ADD COLUMN target_audience text NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'customers', 'staff', 'admins'));

-- Create user notification preferences table
CREATE TABLE public.user_notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  system_enabled boolean NOT NULL DEFAULT true,
  promotional_enabled boolean NOT NULL DEFAULT true,
  updates_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification preferences
CREATE POLICY "Users can view own preferences"
ON public.user_notification_preferences
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
ON public.user_notification_preferences
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
ON public.user_notification_preferences
FOR UPDATE
USING (user_id = auth.uid());

-- Admin can view all preferences (for analytics)
CREATE POLICY "Admin can view all preferences"
ON public.user_notification_preferences
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_notification_preferences_updated_at
BEFORE UPDATE ON public.user_notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_user_notification_preferences_user_id ON public.user_notification_preferences(user_id);