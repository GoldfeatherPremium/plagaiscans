
## Make Landing Page a Closer Replica of reilaa.com/turnitin-report

The current landing already matches the reference's layout, copy, theme, and section order. To bring it the rest of the way to a replica, I'll apply five tightly scoped changes — all to the landing route only, so the rest of the app (dashboard, auth, admin) is untouched.

### 1. Replace the top nav (landing only)
The reference uses a minimal top bar: small dark logo on the left, then `AI Detector · Turnitin Report · Pricing · 🌙 · Sign in · Get Started`. Our landing currently shows our richer global nav.

- In `src/pages/Landing.tsx`, the existing inline `<nav>` already exists — restyle it to match:
  - Left: small circular dark logo with downward triangle mark + no brand text (matches reference) — fall back to "PlagaiScans" text on mobile.
  - Center/right links: `AI Detector` → `/ai-content-detection`, `Turnitin Report` → `/` (current), `Pricing` → `/pricing`.
  - Theme toggle button (sun/moon).
  - `Sign in` (text link → `/auth`) and `Get Started` (solid dark pill button → `/auth`).
- Mobile: collapse links into hamburger; keep theme + Get Started visible.

### 2. Update FAQ to the reference's exact 8 questions
Replace current 5 FAQs with the 8 from the reference, with our own concise answers (so we don't reproduce reilaa's body text):

1. What is a full Turnitin report?
2. How accurate is the Turnitin report?
3. How much does a full Turnitin report cost?
4. How long does it take to get my report?
5. Will my paper be stored or shared?
6. Can I still use the free AI detector?
7. What if I'm not satisfied with my report?
8. Is this affiliated with Turnitin?

Update `src/i18n/locales/en/landing.json` `faq.q1..q8` / `faq.a1..a8`. Map the FAQ array in `Landing.tsx` to render all 8.

### 3. Add "Learn More About Turnitin Reports" block
After the "Ready for Your Full Report?" CTA and before the FAQ, add a 2-card row (matches the reference's bottom cross-link strip):
- **AI Detection Report** → links to `/ai-content-detection`
- **Similarity Report** → links to `/plagiarism-checker`

Each card: small heading + short description + arrow. Same card style as the rest of the page.

### 4. Tighten hero badge style
Match reference's blue solid pill more closely — currently `bg-secondary/10 text-secondary`; switch to solid `bg-secondary text-secondary-foreground` rounded-full pill with uppercase tracking.

### 5. Hide global Navigation on the landing route
We currently render the inline nav inside `Landing.tsx` (good). Confirm `App.tsx` doesn't also stack the global `Navigation` component on `/` — quick verification, no expected change.

### Files
**Edit**
- `src/pages/Landing.tsx` — restyle inline nav, add Learn More block, render 8 FAQs, tighten badge
- `src/i18n/locales/en/landing.json` — add `nav.aiDetector`, `nav.turnitinReport`, `nav.getStarted`; add `learnMore.title`, `learnMore.aiTitle`, `learnMore.aiDesc`, `learnMore.simTitle`, `learnMore.simDesc`; expand `faq.q1..q8` / `faq.a1..a8`

### Out of scope
- No changes to dashboard, auth, admin, blog, footer, theme tokens, or other locale files.
- No copying of reilaa's exact answer text — we write our own concise answers to the same questions.
- No image/asset copying from reilaa.com.

### Verification
After build, view `/` at 411px and desktop and confirm: minimal top nav, hero badge as solid blue pill, "Learn More" cross-link cards above FAQ, and 8 FAQ items rendering.
