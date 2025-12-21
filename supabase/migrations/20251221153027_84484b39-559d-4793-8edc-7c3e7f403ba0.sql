-- Create email settings table for admin to control transactional emails
CREATE TABLE public.email_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  category TEXT NOT NULL DEFAULT 'transactional',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage email settings
CREATE POLICY "Admins can manage email settings" 
ON public.email_settings 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'));

-- Everyone can view email settings (needed for edge functions)
CREATE POLICY "Anyone can view email settings" 
ON public.email_settings 
FOR SELECT 
USING (true);

-- Insert default email settings
INSERT INTO public.email_settings (setting_key, setting_name, description, category, is_enabled) VALUES
('document_completion', 'Document Completion Email', 'Send email when a document scan is completed', 'transactional', true),
('payment_verified', 'Payment Verified Email', 'Send email when a payment is verified and credits added', 'transactional', true),
('password_reset', 'Password Reset Email', 'Send password reset emails to users', 'transactional', true),
('welcome_email', 'Welcome Email', 'Send welcome email to new users after signup', 'transactional', true),
('low_credit_reminder', 'Low Credit Reminder', 'Send reminder when user credit balance is low', 'notifications', false),
('document_pending_reminder', 'Document Pending Reminder', 'Send reminder for pending documents', 'notifications', false);

-- Create index for faster lookups
CREATE INDEX idx_email_settings_key ON public.email_settings(setting_key);