
-- Create remark_presets table
CREATE TABLE public.remark_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  remark_text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.remark_presets ENABLE ROW LEVEL SECURITY;

-- Admin can manage all presets
CREATE POLICY "Admin can manage remark presets"
ON public.remark_presets
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can view active presets
CREATE POLICY "Staff can view active remark presets"
ON public.remark_presets
FOR SELECT
USING (
  is_active = true AND (
    has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_remark_presets_updated_at
BEFORE UPDATE ON public.remark_presets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with all existing unique remarks from documents
INSERT INTO public.remark_presets (remark_text, is_active, sort_order)
SELECT DISTINCT ON (TRIM(remarks)) TRIM(remarks), false, ROW_NUMBER() OVER (ORDER BY TRIM(remarks))::integer
FROM public.documents
WHERE remarks IS NOT NULL AND TRIM(remarks) != ''
ORDER BY TRIM(remarks);
