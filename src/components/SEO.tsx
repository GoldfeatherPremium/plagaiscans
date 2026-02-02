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
  title: 'PlagaiScans - Text Similarity Review and Content Analysis',
  description: 'A text similarity review and content analysis service providing informational reports. Compare documents against indexed sources for your content review process.',
  keywords: 'text similarity, content analysis, document review, similarity report, content review, document comparison',
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
  name: 'Plagaiscans',
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
    name: 'Plagaiscans',
    url: defaultSEO.siteUrl,
  },
});

export const generateServiceSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'Text Similarity Review Service',
  provider: {
    '@type': 'Organization',
    name: 'Plagaiscans',
  },
  description: 'A text similarity review and content analysis service providing informational reports.',
  serviceType: 'Document Analysis',
  areaServed: 'Worldwide',
});

export const generateFAQSchema = (faqs: { question: string; answer: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(faq => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
});

export const generateArticleSchema = (title: string, description: string, url: string, datePublished?: string) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: title,
  description,
  url: `${defaultSEO.siteUrl}${url}`,
  publisher: {
    '@type': 'Organization',
    name: 'Plagaiscans',
    logo: {
      '@type': 'ImageObject',
      url: `${defaultSEO.siteUrl}/favicon.png`,
    },
  },
  datePublished: datePublished || new Date().toISOString(),
});

export const generateSoftwareApplicationSchema = () => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Plagaiscans',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web Browser',
  description: 'A text similarity review and content analysis service providing informational reports.',
  offers: {
    '@type': 'Offer',
    price: '2.00',
    priceCurrency: 'USD',
  },
});
