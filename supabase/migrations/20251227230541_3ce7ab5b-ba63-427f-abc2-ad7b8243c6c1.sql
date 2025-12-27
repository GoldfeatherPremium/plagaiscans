-- Create site_content table for editable text
CREATE TABLE public.site_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_key text NOT NULL UNIQUE,
  content_value text NOT NULL,
  section text NOT NULL DEFAULT 'general',
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Enable RLS
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- Everyone can view site content
CREATE POLICY "Anyone can view site content"
ON public.site_content
FOR SELECT
USING (true);

-- Only admins can manage site content
CREATE POLICY "Admin can manage site content"
ON public.site_content
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_site_content_updated_at
BEFORE UPDATE ON public.site_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default content
INSERT INTO public.site_content (content_key, content_value, section, description) VALUES
-- Hero Section
('hero_badge', 'Trusted by 10,000+ academics & researchers', 'hero', 'Badge text above the main heading'),
('hero_title_line1', 'Plagiarism & Similarity Check', 'hero', 'First line of hero title'),
('hero_title_line2', 'for Academic Integrity', 'hero', 'Second line of hero title (gradient text)'),
('hero_subtitle', 'Plagaiscans helps students, researchers, and educators verify originality, identify overlapping content, and understand similarity results through clear and easy-to-read reports.', 'hero', 'Hero section subtitle'),
('hero_feature_1', 'Detailed Similarity Reports', 'hero', 'First feature pill'),
('hero_feature_2', 'AI Content Detection', 'hero', 'Second feature pill'),
('hero_feature_3', 'Privacy-First Scanning', 'hero', 'Third feature pill'),
('hero_cta_primary', 'Check Document', 'hero', 'Primary CTA button text'),
('hero_cta_secondary', 'View Sample Report', 'hero', 'Secondary CTA button text'),
('hero_stat_1_value', '1B+', 'hero', 'First stat value'),
('hero_stat_1_label', 'Sources Checked', 'hero', 'First stat label'),
('hero_stat_2_value', '99%', 'hero', 'Second stat value'),
('hero_stat_2_label', 'Accuracy Rate', 'hero', 'Second stat label'),
('hero_stat_3_value', '10K+', 'hero', 'Third stat value'),
('hero_stat_3_label', 'Happy Users', 'hero', 'Third stat label'),

-- About Section
('about_label', 'About Plagaiscans', 'about', 'Section label'),
('about_title', 'Academic Integrity Platform for', 'about', 'About section title'),
('about_title_gradient', 'Originality Verification', 'about', 'About title gradient part'),
('about_paragraph_1', 'Plagaiscans is an academic integrity platform designed to support plagiarism detection and similarity analysis for educational and research use. Our system helps users understand content originality by highlighting overlapping text, source references, and similarity percentages in a clear and structured format.', 'about', 'First paragraph'),
('about_paragraph_2', 'We also provide optional AI-content indicators to help users assess whether parts of a document may include AI-generated text. These indicators are designed to support academic review, not replace human judgment. Plagaiscans prioritizes privacy, transparency, and usability—ensuring users can verify originality with confidence.', 'about', 'Second paragraph'),
('about_feature_1_title', 'Similarity Detection', 'about', 'Feature 1 title'),
('about_feature_1_desc', 'View highlighted matches, similarity percentages, and matched sources to understand content overlap.', 'about', 'Feature 1 description'),
('about_feature_2_title', 'Citation & Reference Checks', 'about', 'Feature 2 title'),
('about_feature_2_desc', 'Support academic compliance by reviewing citation patterns and references.', 'about', 'Feature 2 description'),
('about_feature_3_title', 'AI Content Indicators', 'about', 'Feature 3 title'),
('about_feature_3_desc', 'Analyze text for potential AI-generated patterns to support responsible academic use.', 'about', 'Feature 3 description'),
('about_feature_4_title', 'Privacy-First Scanning', 'about', 'Feature 4 title'),
('about_feature_4_desc', 'Uploaded documents remain private and are processed securely.', 'about', 'Feature 4 description'),

-- Services/Features Section
('services_label', 'Features', 'services', 'Section label'),
('services_title', 'Comprehensive Document', 'services', 'Services title'),
('services_title_gradient', 'Analysis', 'services', 'Services title gradient'),
('services_subtitle', 'Professional plagiarism detection and similarity checking tools for students, researchers, and universities.', 'services', 'Services subtitle'),

-- Contact Section
('contact_label', 'Get in Touch', 'contact', 'Section label'),
('contact_title', 'Ready to Check Your', 'contact', 'Contact title'),
('contact_title_gradient', 'Documents?', 'contact', 'Contact title gradient'),
('contact_subtitle', 'Join thousands of students, researchers, and educators who trust Plagaiscans for accurate plagiarism detection and AI content analysis. Check originality and protect academic integrity.', 'contact', 'Contact subtitle'),
('contact_tagline', 'Clear similarity reports you can trust.', 'contact', 'Contact tagline'),
('contact_email', 'support@plagaiscans.com', 'contact', 'Contact email'),

-- Footer
('footer_description', 'Professional document similarity and AI content detection services for academic integrity.', 'footer', 'Footer description'),
('footer_disclaimer', 'This service is provided for informational and research purposes only.', 'footer', 'Footer disclaimer'),
('footer_company_name', 'Goldfeather Prem Ltd', 'footer', 'Company legal name'),
('footer_country', 'United Kingdom', 'footer', 'Company country'),

-- Navigation
('nav_brand', 'Plagaiscans', 'navigation', 'Brand name in navigation'),

-- SEO
('seo_title', 'PlagaiScans - Professional Plagiarism & AI Content Detection Service', 'seo', 'Page title'),
('seo_description', 'Plagaiscans provides plagiarism & similarity checking with clear reports and source insights for students, researchers, and universities.', 'seo', 'Meta description');