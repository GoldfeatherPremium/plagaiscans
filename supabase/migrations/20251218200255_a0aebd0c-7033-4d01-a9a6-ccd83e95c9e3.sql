-- Create pricing_packages table for admin price management
CREATE TABLE public.pricing_packages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    credits INTEGER NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on pricing_packages
ALTER TABLE public.pricing_packages ENABLE ROW LEVEL SECURITY;

-- Everyone can view active packages
CREATE POLICY "Everyone can view active packages"
ON public.pricing_packages
FOR SELECT
USING (is_active = true);

-- Admin can manage all packages
CREATE POLICY "Admin can manage packages"
ON public.pricing_packages
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_pricing_packages_updated_at
BEFORE UPDATE ON public.pricing_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add error_message column to documents
ALTER TABLE public.documents ADD COLUMN error_message TEXT;

-- Insert default pricing packages including 1-check package
INSERT INTO public.pricing_packages (credits, price) VALUES
    (1, 3),
    (10, 15),
    (25, 30),
    (50, 50),
    (100, 90);