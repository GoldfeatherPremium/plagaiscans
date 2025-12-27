-- Create email warm-up settings and tracking table
CREATE TABLE public.email_warmup_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_warmup_active BOOLEAN NOT NULL DEFAULT true,
  warmup_start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_warmup_day INTEGER NOT NULL DEFAULT 1,
  daily_limit INTEGER NOT NULL DEFAULT 5,
  emails_sent_today INTEGER NOT NULL DEFAULT 0,
  last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
  tracking_disabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_warmup_settings ENABLE ROW LEVEL SECURITY;

-- Admin-only access policies
CREATE POLICY "Admins can view email warmup settings" 
ON public.email_warmup_settings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update email warmup settings" 
ON public.email_warmup_settings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can insert email warmup settings" 
ON public.email_warmup_settings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Insert default settings
INSERT INTO public.email_warmup_settings (
  is_warmup_active,
  warmup_start_date,
  current_warmup_day,
  daily_limit,
  emails_sent_today,
  tracking_disabled
) VALUES (
  true,
  now(),
  1,
  5,
  0,
  true
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_email_warmup_settings_updated_at
BEFORE UPDATE ON public.email_warmup_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();