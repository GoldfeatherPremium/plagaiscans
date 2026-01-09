-- Extension authentication tokens for Chrome extension
CREATE TABLE public.extension_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  last_heartbeat_at TIMESTAMPTZ,
  browser_info TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Extension activity logs
CREATE TABLE public.extension_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id UUID REFERENCES public.extension_tokens(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  status TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Turnitin slot configuration
CREATE TABLE public.turnitin_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_number INTEGER NOT NULL,
  slot_name TEXT NOT NULL,
  slot_url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  max_files_per_day INTEGER DEFAULT 25,
  current_usage INTEGER DEFAULT 0,
  last_reset_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.extension_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extension_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turnitin_slots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for extension_tokens
CREATE POLICY "Admins can manage all extension tokens"
ON public.extension_tokens
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view their own tokens"
ON public.extension_tokens
FOR SELECT
USING (auth.uid() = user_id);

-- RLS Policies for extension_logs
CREATE POLICY "Admins can view all extension logs"
ON public.extension_logs
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view logs for their tokens"
ON public.extension_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.extension_tokens
    WHERE extension_tokens.id = extension_logs.token_id
    AND extension_tokens.user_id = auth.uid()
  )
);

-- RLS Policies for turnitin_slots
CREATE POLICY "Admins can manage turnitin slots"
ON public.turnitin_slots
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view turnitin slots"
ON public.turnitin_slots
FOR SELECT
USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_extension_tokens_user_id ON public.extension_tokens(user_id);
CREATE INDEX idx_extension_tokens_token ON public.extension_tokens(token);
CREATE INDEX idx_extension_logs_token_id ON public.extension_logs(token_id);
CREATE INDEX idx_extension_logs_document_id ON public.extension_logs(document_id);
CREATE INDEX idx_extension_logs_created_at ON public.extension_logs(created_at DESC);
CREATE INDEX idx_turnitin_slots_is_active ON public.turnitin_slots(is_active);

-- Function to generate secure token
CREATE OR REPLACE FUNCTION public.generate_extension_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..64 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN 'ext_' || result;
END;
$$;

-- Trigger to update turnitin_slots updated_at
CREATE OR REPLACE FUNCTION public.update_turnitin_slots_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER turnitin_slots_updated_at
BEFORE UPDATE ON public.turnitin_slots
FOR EACH ROW
EXECUTE FUNCTION public.update_turnitin_slots_updated_at();

-- Enable realtime for extension_logs for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.extension_logs;