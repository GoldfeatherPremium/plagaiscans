import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  noIndex?: boolean;
  structuredData?: object;
}

const defaultSEO = {
  siteName: 'PlagaiScans',
  title: 'PlagaiScans - Plagiarism & AI Detection for Academic Integrity',
  description: 'Professional plagiarism detection and AI content analysis for students, researchers, and educators. Get detailed similarity reports and AI detection with fast processing.',
  keywords: 'plagiarism checker, plagiarism detection, AI detection, similarity report, academic integrity, document analysis, content verification',
  ogImage: '/og-image.png',
  siteUrl: 'https://plagaiscans.com',
};

export function SEO({
  title,
  description = defaultSEO.description,
  keywords = defaultSEO.keywords,
  canonicalUrl,
  ogImage = defaultSEO.ogImage,
  ogType = 'website',
  noIndex = false,
  structuredData,
}: SEOProps) {
  const fullTitle = title 
    ? `${title} | ${defaultSEO.siteName}` 
    : defaultSEO.title;

  const fullCanonicalUrl = canonicalUrl 
    ? `${defaultSEO.siteUrl}${canonicalUrl}` 
    : undefined;

  const fullOgImage = ogImage.startsWith('http') 
    ? ogImage 
    : `${defaultSEO.siteUrl}${ogImage}`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* Robots */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      
      {/* Canonical URL */}
      {fullCanonicalUrl && <link rel="canonical" href={fullCanonicalUrl} />}
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullOgImage} />
      <meta property="og:site_name" content={defaultSEO.siteName} />
      {fullCanonicalUrl && <meta property="og:url" content={fullCanonicalUrl} />}
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullOgImage} />
      
      {/* Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}

// Predefined structured data generators
export const generateOrganizationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'PlagaiScans',
  url: defaultSEO.siteUrl,
  logo: `${defaultSEO.siteUrl}/favicon.png`,
  description: defaultSEO.description,
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'support@plagaiscans.com',
    contactType: 'customer service',
  },
});

export const generateWebPageSchema = (title: string, description: string, url: string) => ({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: title,
  description,
  url: `${defaultSEO.siteUrl}${url}`,
  isPartOf: {
    '@type': 'WebSite',
    name: 'PlagaiScans',
    url: defaultSEO.siteUrl,
  },
});

export const generateServiceSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Plagiarism Detection Service',
  provider: {
    '@type': 'Organization',
    name: 'PlagaiScans',
  },
  description: 'Professional plagiarism detection and AI content analysis for academic documents.',
  serviceType: 'Document Analysis',
  areaServed: 'Worldwide',
});
