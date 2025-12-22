-- Create AI admin settings table
CREATE TABLE public.ai_admin_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    is_enabled boolean NOT NULL DEFAULT false,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO public.ai_admin_settings (is_enabled) VALUES (false);

-- Enable RLS
ALTER TABLE public.ai_admin_settings ENABLE ROW LEVEL SECURITY;

-- Only admin can manage AI settings
CREATE POLICY "Admin can manage AI settings"
ON public.ai_admin_settings FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create AI change versions table for rollback
CREATE TABLE public.ai_change_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number serial,
    change_type text NOT NULL,
    change_description text NOT NULL,
    affected_areas text[] NOT NULL DEFAULT '{}',
    changes_json jsonb NOT NULL,
    applied_by uuid NOT NULL,
    applied_at timestamp with time zone NOT NULL DEFAULT now(),
    is_active boolean NOT NULL DEFAULT true,
    rolled_back_at timestamp with time zone,
    rolled_back_by uuid
);

-- Enable RLS
ALTER TABLE public.ai_change_versions ENABLE ROW LEVEL SECURITY;

-- Only admin can manage versions
CREATE POLICY "Admin can manage AI versions"
ON public.ai_change_versions FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create AI audit logs table
CREATE TABLE public.ai_audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id uuid NOT NULL,
    prompt_text text NOT NULL,
    ai_response text NOT NULL,
    proposed_changes jsonb,
    status text NOT NULL DEFAULT 'pending',
    version_id uuid REFERENCES public.ai_change_versions(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    resolved_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admin can view audit logs
CREATE POLICY "Admin can manage AI audit logs"
ON public.ai_audit_logs FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));