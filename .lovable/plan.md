

## Goal
Make `/`, `/pricing`, `/about-us`, `/contact`, `/terms-and-conditions`, `/privacy-policy`, `/refund-policy`, and `/academic-integrity` return real, crawlable HTML — with content, meta tags, and a `<noscript>` fallback — instead of an empty React shell.

## Constraint that shapes the approach
Lovable hosts static files only (no Node SSR, no per-request rendering). True runtime SSR is not possible. The correct fix is **build-time prerendering (SSG)**: at `vite build`, render each listed route to its own static HTML file (`/pricing/index.html`, `/contact/index.html`, etc.). Lovable's static host then serves real HTML for every URL, and React hydrates on top.

## What gets built

### 1. Add a prerender step to the Vite build
- Install `vite-plugin-prerender` (Puppeteer-based, runs after `vite build`).
- Configure it with the exact public routes:
  - `/`
  - `/pricing`
  - `/about-us`
  - `/contact`
  - `/terms-and-conditions`
  - `/privacy-policy`
  - `/refund-policy`
  - `/academic-integrity`
- Output: `dist/pricing/index.html`, `dist/contact/index.html`, etc. — each containing the fully rendered DOM, meta tags, and `<noscript>` block for that page.
- React still hydrates normally after load; SPA navigation is unchanged.

### 2. Per-route `<title>`, `<meta description>`, OG tags, canonical
- The project already uses `react-helmet-async` and a shared `SEO` component (`src/components/SEO.tsx`).
- Audit each of the 8 public pages and ensure each renders `<SEO ... canonicalUrl=... />` with a unique title, description, keywords, OG image, and canonical URL.
- Pages already wired (verified): `RefundPolicy`, `TermsAndConditions`. Pages to audit/fix: `Landing`, `Pricing`, `AboutUs`, `Contact`, `PrivacyPolicy`, `AcademicIntegrity`.
- Because prerender executes Helmet during the headless render, the final static HTML files will contain the correct `<title>` / `<meta>` / `<link rel="canonical">` baked in — visible to `curl` and crawlers.

### 3. Add a `<noscript>` fallback inside each page
- Add a `<NoScriptFallback>` block to each of the 8 public pages (rendered inside the page component, so prerender includes it). Content per page:
  - **Landing**: product summary, key features, pricing teaser, links to all policy pages and contact.
  - **Pricing**: plain-text plan list with per-credit pricing.
  - **About**: company description (Plagaiscans Technologies Ltd, UK).
  - **Contact**: support email, WhatsApp number, address.
  - **Terms / Privacy / Refund / Academic Integrity**: the page's actual policy text in plain HTML.
- All `<noscript>` blocks include a footer with anchor links to every other public page, so a no-JS crawler can follow the full site graph.

### 4. Replace the generic loading skeleton in `index.html`
- The current `<div id="root">` skeleton is generic ("Plagaiscans" + spinner). Replace it with a minimal site-wide `<noscript>` block containing the brand description and links to all 8 public pages, so even routes that aren't prerendered still expose crawlable text.

### 5. Sitemap & robots sanity check
- Verify `public/sitemap.xml` lists all 8 prerendered routes with correct canonical URLs.
- Verify `public/robots.txt` allows indexing and references the sitemap.

## Technical details

### Files changed / added
```text
vite.config.ts                              add vite-plugin-prerender + route list
package.json                                add vite-plugin-prerender (devDep)
index.html                                  replace skeleton with site-wide <noscript>
src/components/NoScriptFallback.tsx         new — per-page text fallback component
src/pages/Landing.tsx                       add <SEO> + <NoScriptFallback>
src/pages/Pricing.tsx                       add <SEO> + <NoScriptFallback>
src/pages/AboutUs.tsx                       add <SEO> + <NoScriptFallback>
src/pages/Contact.tsx                       add <SEO> + <NoScriptFallback>
src/pages/PrivacyPolicy.tsx                 add <NoScriptFallback>
src/pages/TermsAndConditions.tsx            add <NoScriptFallback>
src/pages/RefundPolicy.tsx                  add <NoScriptFallback>
src/pages/AcademicIntegrity.tsx             add <SEO> + <NoScriptFallback>
public/sitemap.xml                          verify all 8 routes present
```

### Build-time flow
```text
vite build
   │
   ├─ produces dist/index.html + JS bundles (as today)
   │
   └─ vite-plugin-prerender (post-build hook)
         │
         ├─ launches headless Chromium, loads dist/index.html
         ├─ visits each configured route in-app
         ├─ waits for Helmet + page render
         └─ writes:
              dist/index.html              (Landing, fully rendered)
              dist/pricing/index.html
              dist/about-us/index.html
              dist/contact/index.html
              dist/terms-and-conditions/index.html
              dist/privacy-policy/index.html
              dist/refund-policy/index.html
              dist/academic-integrity/index.html
```

### Verification after deploy
```text
curl https://plagaiscans.com/pricing
   → returns full HTML with pricing copy, <title>Pricing | Plagaiscans</title>,
     canonical link, OG tags, and <noscript> fallback.

curl https://plagaiscans.com/contact
   → returns full HTML with support email + WhatsApp visible in body.
```

### Out of scope / not possible on Lovable static hosting
- True per-request server rendering (Next.js-style SSR) — not supported on Lovable hosting; prerender at build time is the equivalent and gives identical SEO benefits for these 8 static pages.
- Prerendering authenticated/dynamic pages (`/dashboard/*`, `/checkout`) — intentionally excluded; they remain client-rendered.

## Expected outcome
- `curl` on any of the 8 public URLs returns real HTML with the page's content, correct `<title>`, `<meta description>`, canonical URL, OG/Twitter tags, and a `<noscript>` text block — no empty `<div id="root">`.
- Google, Bing, and social scrapers see full content immediately, no JS execution required.
- React hydrates on load; user-facing navigation and behavior are unchanged.
