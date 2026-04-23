// Single source of truth for public routes included in sitemap.xml.
// Add a new entry here whenever you add a new public-facing page.
// The sitemap is regenerated automatically on `vite build` and `vite` (dev start)
// by the `autoSitemapPlugin` in vite.config.ts.

export type ChangeFreq =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

export interface SitemapRoute {
  /** Path starting with `/`. Will be appended to SITE_URL. */
  path: string;
  /** Recommended crawl frequency. */
  changefreq: ChangeFreq;
  /** Priority 0.0 – 1.0 */
  priority: number;
}

/** Production canonical site URL (no trailing slash). */
export const SITE_URL = 'https://plagaiscans.com';

/**
 * All public, indexable routes.
 * Do NOT include: auth-protected routes, dashboard routes, dynamic-only routes,
 * or duplicate aliases (pick the canonical path).
 */
export const SITEMAP_ROUTES: SitemapRoute[] = [
  { path: '/', changefreq: 'weekly', priority: 1.0 },
  { path: '/plagiarism-checker', changefreq: 'weekly', priority: 0.9 },
  { path: '/ai-content-detection', changefreq: 'weekly', priority: 0.9 },
  { path: '/similarity-report', changefreq: 'weekly', priority: 0.8 },
  { path: '/pricing', changefreq: 'weekly', priority: 0.8 },
  { path: '/how-it-works', changefreq: 'monthly', priority: 0.7 },
  { path: '/use-cases', changefreq: 'monthly', priority: 0.7 },
  { path: '/about-us', changefreq: 'monthly', priority: 0.6 },
  { path: '/faq', changefreq: 'monthly', priority: 0.6 },
  { path: '/contact', changefreq: 'monthly', priority: 0.6 },
  { path: '/academic-integrity', changefreq: 'monthly', priority: 0.6 },
  { path: '/acceptable-use', changefreq: 'monthly', priority: 0.5 },
  { path: '/resources', changefreq: 'monthly', priority: 0.5 },
  { path: '/blog/what-is-plagiarism', changefreq: 'monthly', priority: 0.7 },
  { path: '/blog/after-plagiarism-report', changefreq: 'weekly', priority: 0.7 },
  { path: '/terms-and-conditions', changefreq: 'yearly', priority: 0.3 },
  { path: '/privacy-policy', changefreq: 'yearly', priority: 0.3 },
  { path: '/refund-policy', changefreq: 'yearly', priority: 0.3 },
  { path: '/auth', changefreq: 'monthly', priority: 0.5 },
  { path: '/guest-upload', changefreq: 'monthly', priority: 0.5 },
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Build a sitemap.xml string from the routes above. */
export function buildSitemapXml(
  routes: SitemapRoute[] = SITEMAP_ROUTES,
  siteUrl: string = SITE_URL,
  lastmod: string = new Date().toISOString().slice(0, 10),
): string {
  const urls = routes
    .map((route) => {
      const loc = `${siteUrl.replace(/\/$/, '')}${route.path}`;
      return [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${route.changefreq}</changefreq>`,
        `    <priority>${route.priority.toFixed(1)}</priority>`,
        '  </url>',
      ].join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
