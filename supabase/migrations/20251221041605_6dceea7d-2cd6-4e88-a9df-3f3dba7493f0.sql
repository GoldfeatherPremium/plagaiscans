-- Create staff permissions table
CREATE TABLE public.staff_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  permission_key text NOT NULL UNIQUE,
  permission_name text NOT NULL,
  description text,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

-- Admin can manage permissions
CREATE POLICY "Admin can manage staff permissions" ON public.staff_permissions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can view enabled permissions
CREATE POLICY "Staff can view enabled permissions" ON public.staff_permissions
  FOR SELECT USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Insert default permissions
INSERT INTO public.staff_permissions (permission_key, permission_name, description, is_enabled) VALUES
  ('can_edit_completed_documents', 'Edit Completed Documents', 'Allow staff to edit/replace files on completed documents', false),
  ('can_view_customer_info', 'View Customer Info', 'Allow staff to see customer email and name', true),
  ('can_add_remarks', 'Add Remarks', 'Allow staff to add remarks to documents', true),
  ('can_batch_process', 'Batch Process', 'Allow staff to use batch processing features', true),
  ('can_release_documents', 'Release Documents', 'Allow staff to release assigned documents back to queue', true);

-- Create updated_at trigger
CREATE TRIGGER update_staff_permissions_updated_at
  BEFORE UPDATE ON public.staff_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();