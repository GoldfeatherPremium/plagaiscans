

## Plan: Auto-Delete Documents, Performance Optimization, SEO, Analytics Improvements, and PWA Enhancements

This plan covers the three areas you requested, broken into clear phases.

---

### 1. Auto-Delete Document Files After 10 Days

**What it does:** Automatically deletes uploaded files (documents, reports) from storage after 10 days, while keeping the database record intact so you can still see document history, stats, and metadata in admin and customer views.

**Changes:**
- Update the existing `cleanup-old-files` edge function to use a **10-day retention** (currently defaults to 7 days) and make it the hardcoded default
- Set up a **scheduled task (cron job)** to run this function automatically every day -- no manual triggering needed
- The function already preserves database records and only nullifies file paths after deleting storage files, which is exactly what you want

**Technical details:**
- Modify `supabase/functions/cleanup-old-files/index.ts` to default to 10 days
- Create a daily cron job via SQL (`cron.schedule`) that calls the cleanup function once per day
- The `files_cleaned_at` column already tracks which documents have been cleaned

---

### 2. Website Performance Optimization

**What it does:** Makes the website load significantly faster by reducing unnecessary work during initial page load.

**Changes:**

**a) Faster initial load -- defer non-critical work**
- Move the `useMaintenanceMode` hook call out of the critical rendering path for public routes. Currently it blocks the Landing page render with a database query. Instead, render the page immediately and check maintenance in the background
- Add `staleTime` and smarter defaults to the `QueryClient` so pages don't re-fetch data they already have

**b) Optimize QueryClient configuration**
- Set `staleTime: 5 * 60 * 1000` (5 minutes) so data isn't re-fetched on every page navigation
- Set `gcTime: 10 * 60 * 1000` (10 minutes) for garbage collection
- This alone will make navigating between dashboard pages feel instant

**c) Preload critical assets**
- Add `<link rel="preconnect">` for the backend URL in `index.html` so the browser starts the connection early
- Add font preloading hints

**d) Reduce Landing page auth overhead**
- The Landing page currently initializes `useAuth()` which triggers profile + role database queries even for anonymous visitors. Optimize to skip these queries when no session exists

---

### 3. SEO Improvements

**What it does:** Improves Google ranking and search visibility.

**Changes:**

**a) Enhanced meta tags on all public pages**
- Add Open Graph image tags to pages that are missing them (How It Works, Use Cases, FAQ, Contact, About Us)
- Ensure all public pages have unique, keyword-rich `<title>` and `<meta description>` tags

**b) Improve sitemap.xml**
- Update `public/sitemap.xml` to include all public routes with proper `lastmod`, `changefreq`, and `priority` values
- Add the blog post URL and all service pages

**c) Add FAQ structured data**
- Add `FAQPage` JSON-LD schema to the FAQ page and to the landing page FAQ section so Google shows rich snippets in search results

**d) Performance signals (Core Web Vitals)**
- The performance fixes from section 2 directly improve Google ranking since page speed is a ranking factor

---

### 4. Analytics and Overview Improvements

**What it does:** Makes the admin dashboard overview and analytics pages more useful.

**Changes:**

**a) Admin Dashboard Overview enhancements**
- Add a "Revenue this month" quick stat card
- Add a "New users this week" growth indicator
- Add document processing rate (avg time from pending to completed)

**b) Customer Dashboard improvements**
- Show credit expiration countdown more prominently
- Add a "documents processed this month" mini-chart

---

### 5. PWA / Mobile App Improvements

**What it does:** Better mobile experience and offline support.

**Changes:**

**a) Improve service worker caching**
- Update `public/sw.js` to cache API responses for offline viewing of dashboard data
- Add better offline fallback page with branding

**b) Better install experience**
- Improve the `/install` page with device-specific instructions
- Add a bottom-bar install prompt on mobile that appears after 2 page views (non-intrusive)

---

### Implementation Order

1. Performance optimization (biggest user impact)
2. Auto-delete documents cron job
3. SEO improvements
4. Analytics enhancements
5. PWA improvements

### Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/cleanup-old-files/index.ts` | Modify default to 10 days |
| SQL (cron job) | Create daily schedule for cleanup |
| `src/App.tsx` | Optimize QueryClient config |
| `src/hooks/useMaintenanceMode.ts` | Non-blocking for public routes |
| `index.html` | Add preconnect hints |
| `public/sitemap.xml` | Update with all routes |
| `src/pages/FAQ.tsx` | Add FAQPage structured data |
| `src/pages/AdminDashboardOverview.tsx` | Enhanced stats |
| `src/pages/Dashboard.tsx` | Better credit expiry visibility |
| `public/sw.js` | Improved caching strategy |
| `src/pages/Install.tsx` | Device-specific instructions |

