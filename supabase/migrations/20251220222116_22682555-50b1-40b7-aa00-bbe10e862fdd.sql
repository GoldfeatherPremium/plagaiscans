-- Create magic_upload_links table
CREATE TABLE public.magic_upload_links (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    max_uploads INTEGER NOT NULL DEFAULT 1,
    current_uploads INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'disabled')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast token lookups
CREATE INDEX idx_magic_upload_links_token ON public.magic_upload_links(token);

-- Enable RLS
ALTER TABLE public.magic_upload_links ENABLE ROW LEVEL SECURITY;

-- Admin can manage all links
CREATE POLICY "Admin can manage magic links"
ON public.magic_upload_links
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Public can read active links by token (for validation)
CREATE POLICY "Anyone can validate tokens"
ON public.magic_upload_links
FOR SELECT
USING (status = 'active');

-- Public can update upload count (for incrementing)
CREATE POLICY "Anyone can increment upload count"
ON public.magic_upload_links
FOR UPDATE
USING (status = 'active')
WITH CHECK (status = 'active');

-- Create trigger for updated_at
CREATE TRIGGER update_magic_upload_links_updated_at
BEFORE UPDATE ON public.magic_upload_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create magic_upload_files table to track files uploaded via magic links
CREATE TABLE public.magic_upload_files (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    magic_link_id UUID NOT NULL REFERENCES public.magic_upload_links(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.magic_upload_files ENABLE ROW LEVEL SECURITY;

-- Admin can view all magic upload files
CREATE POLICY "Admin can view magic upload files"
ON public.magic_upload_files
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can insert files (for guest uploads)
CREATE POLICY "Anyone can insert magic upload files"
ON public.magic_upload_files
FOR INSERT
WITH CHECK (true);

-- Create storage policy for magic uploads bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('magic-uploads', 'magic-uploads', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for magic-uploads bucket
CREATE POLICY "Anyone can upload to magic-uploads"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'magic-uploads');

CREATE POLICY "Admin can view magic-uploads"
ON storage.objects
FOR SELECT
USING (bucket_id = 'magic-uploads' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete from magic-uploads"
ON storage.objects
FOR DELETE
USING (bucket_id = 'magic-uploads' AND has_role(auth.uid(), 'admin'::app_role));