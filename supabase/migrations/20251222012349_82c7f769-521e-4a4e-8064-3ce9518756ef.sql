-- Add referral system table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_user_id uuid UNIQUE,
  referral_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  credits_earned integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own referrals"
ON public.referrals FOR SELECT
USING (referrer_id = auth.uid());

CREATE POLICY "Users can create referral codes"
ON public.referrals FOR INSERT
WITH CHECK (referrer_id = auth.uid());

CREATE POLICY "System can update referrals"
ON public.referrals FOR UPDATE
USING (true);

CREATE POLICY "Admin can view all referrals"
ON public.referrals FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add referral_code to profiles for easy lookup
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by uuid;

-- Add document tags table
CREATE TABLE public.document_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text DEFAULT '#6366f1',
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tags"
ON public.document_tags FOR ALL
USING (user_id = auth.uid());

-- Add tags to documents (many-to-many)
CREATE TABLE public.document_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.document_tags(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(document_id, tag_id)
);

ALTER TABLE public.document_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own document tags"
ON public.document_tag_assignments FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.documents d 
  WHERE d.id = document_id AND d.user_id = auth.uid()
));

-- Add favorites column to documents
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;

-- Create function to generate referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.referral_code := 'REF' || UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 8));
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate referral code on profile creation
DROP TRIGGER IF EXISTS on_profile_create_referral_code ON public.profiles;
CREATE TRIGGER on_profile_create_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION public.generate_referral_code();