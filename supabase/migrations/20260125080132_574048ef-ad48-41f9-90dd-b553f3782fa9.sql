-- Add automation tracking columns to documents table
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS automation_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS automation_error TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS automation_started_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS automation_attempt_count INTEGER DEFAULT 0;

-- Create index for efficient polling of pending documents
CREATE INDEX IF NOT EXISTS idx_documents_automation_pending 
ON public.documents(uploaded_at DESC) 
WHERE status = 'pending' AND automation_status IS NULL;

-- Create index for processing documents
CREATE INDEX IF NOT EXISTS idx_documents_automation_processing 
ON public.documents(automation_started_at) 
WHERE automation_status = 'processing';

-- Create extension_auth_tokens table for secure extension authentication
CREATE TABLE IF NOT EXISTS public.extension_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT 'Turnitin Automation',
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '1 year')
);

-- Enable RLS on extension_auth_tokens
ALTER TABLE public.extension_auth_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for extension_auth_tokens
CREATE POLICY "Users can view their own tokens"
ON public.extension_auth_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tokens"
ON public.extension_auth_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
ON public.extension_auth_tokens FOR DELETE
USING (auth.uid() = user_id);

-- Create automation_logs table for tracking extension activity
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'info',
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on automation_logs
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- Only admins and staff can view automation logs
CREATE POLICY "Staff can view automation logs"
ON public.automation_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'staff')
  )
);

-- Allow inserts from service role (extension uses service key)
CREATE POLICY "Service role can insert automation logs"
ON public.automation_logs FOR INSERT
WITH CHECK (true);

-- Create index for automation logs
CREATE INDEX IF NOT EXISTS idx_automation_logs_document 
ON public.automation_logs(document_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automation_logs_created 
ON public.automation_logs(created_at DESC);