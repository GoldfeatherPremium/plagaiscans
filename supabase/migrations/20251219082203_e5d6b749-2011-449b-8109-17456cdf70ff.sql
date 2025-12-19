-- Create staff_settings table for per-staff limits
CREATE TABLE public.staff_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  time_limit_minutes INTEGER NOT NULL DEFAULT 30,
  max_concurrent_files INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_settings ENABLE ROW LEVEL SECURITY;

-- Admins can manage all staff settings
CREATE POLICY "Admin can manage staff settings" ON public.staff_settings
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can view their own settings
CREATE POLICY "Staff can view own settings" ON public.staff_settings
FOR SELECT USING (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_staff_settings_updated_at
BEFORE UPDATE ON public.staff_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();