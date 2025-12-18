-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'customer');

-- Create document status enum
CREATE TYPE public.document_status AS ENUM ('pending', 'in_progress', 'completed');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    credit_balance INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create documents table
CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    status document_status NOT NULL DEFAULT 'pending',
    assigned_staff_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    similarity_percentage DECIMAL(5,2),
    ai_percentage DECIMAL(5,2),
    similarity_report_path TEXT,
    ai_report_path TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create activity_logs table
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create settings table for WhatsApp number
CREATE TABLE public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default WhatsApp number
INSERT INTO public.settings (key, value) VALUES ('whatsapp_number', '+1234567890');

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
        AND role = _role
    )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert into profiles
    INSERT INTO public.profiles (id, email, full_name, phone)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', '')
    );
    
    -- Assign customer role by default
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'customer');
    
    RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON public.settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Admin can view all profiles"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Admin can update all profiles"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view own role"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Admin can view all roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can manage roles"
    ON public.user_roles FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Documents policies
CREATE POLICY "Customers can view own documents"
    ON public.documents FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Staff can view all documents"
    ON public.documents FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can insert own documents"
    ON public.documents FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can update documents"
    ON public.documents FOR UPDATE
    TO authenticated
    USING (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin can delete documents"
    ON public.documents FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Activity logs policies
CREATE POLICY "Staff can view own logs"
    ON public.activity_logs FOR SELECT
    TO authenticated
    USING (staff_id = auth.uid());

CREATE POLICY "Admin can view all logs"
    ON public.activity_logs FOR SELECT
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can insert logs"
    ON public.activity_logs FOR INSERT
    TO authenticated
    WITH CHECK (public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'admin'));

-- Settings policies
CREATE POLICY "Everyone can view settings"
    ON public.settings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admin can manage settings"
    ON public.settings FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for documents
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false);

-- Storage policies for documents bucket
CREATE POLICY "Users can upload own documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'documents' AND (
        auth.uid()::text = (storage.foldername(name))[1]
        OR public.has_role(auth.uid(), 'staff')
        OR public.has_role(auth.uid(), 'admin')
    ));

CREATE POLICY "Staff can download all documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'documents' AND (
        public.has_role(auth.uid(), 'staff')
        OR public.has_role(auth.uid(), 'admin')
    ));

-- Storage policies for reports bucket
CREATE POLICY "Staff can upload reports"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'reports' AND (
        public.has_role(auth.uid(), 'staff')
        OR public.has_role(auth.uid(), 'admin')
    ));

CREATE POLICY "Users can view own reports"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'reports' AND (
        auth.uid()::text = (storage.foldername(name))[1]
        OR public.has_role(auth.uid(), 'staff')
        OR public.has_role(auth.uid(), 'admin')
    ));