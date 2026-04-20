
## Match reilaa.com hero typography exactly + side-menu cleanup + remove "Credits never expire"

Three tightly scoped edits, all to the landing page only.

### 1. Hero — match reference typography, color, spacing
File: `src/pages/Landing.tsx` (hero section, lines 199–246) and `src/index.css` (font family).

**Font**: reference uses **Inter** as body font (`font-inter`). Our `font-display` currently maps to a different family. Switch the hero `<h1>`, badge and subtitle to use Inter via Tailwind's default `font-sans` (already Inter-like) — explicitly add `font-sans` and remove `font-display` on hero text so it renders in the same geometric sans as reilaa. (Project-wide font tokens stay untouched.)

**Badge** (`REAL TURNITIN • NO REPOSITORY`):
- Smaller pill: `px-5 py-2`, `text-[13px]`, `font-bold`, `tracking-wide` (not widest), uppercase, solid blue `bg-secondary text-secondary-foreground`, `rounded-full`.
- Margin below: `mb-6` (was `mb-8`).

**Heading** (`<h1>`):
- Sizes: `text-[44px] sm:text-[56px] lg:text-[64px]` with `leading-[1.05]` and `tracking-tight` to match the reference's tight, large display.
- Weight: `font-bold` (700, matches reference).
- Line 1 color: gray `text-gray-500 dark:text-gray-400` (lighter than our current `text-muted-foreground`).
- Line 2 color: keep `text-primary` (green) — matches reference green.
- Spacing: `mb-5` between heading and subtitle.

**Subtitle**:
- Size: `text-[17px] sm:text-[18px]`, `leading-[1.6]`, `text-gray-600 dark:text-gray-400`.
- Width: `max-w-xl mx-auto` (slightly tighter than current `max-w-2xl`).
- Margin: `mb-10` to upload card.
- Render with bold span on "exact same report" via `<Trans>` or a small inline split (split the i18n string into 3 parts: prefix, bold, suffix) so it visually matches reference.

**Hero section padding**: `pt-12 sm:pt-20 pb-10 sm:pb-16` (reference is fairly tight at top on mobile, generous on desktop).

**Upload card** stays as-is (already matches reference well: dashed green border, green circle upload icon, two pill buttons).

### 2. Remove "Credits never expire"
File: `src/i18n/locales/en/landing.json`

- `ready.subtitle`: change from  
  `"Get complete AI detection and similarity analysis for just $3.99. Credits never expire."`  
  to  
  `"Get complete AI detection and similarity analysis for just $3.99."`
- `faq.a3`: change from  
  `"Just $3.99 per report. There are no subscriptions, no recurring charges, and credits never expire."`  
  to  
  `"Just $3.99 per report. There are no subscriptions, no recurring charges, and no hidden fees."`

No other locale files touched.

### 3. Side menu (mobile sheet) — remove AI Detector, add Pricing + Sign Up/Login
File: `src/pages/Landing.tsx` (Sheet content, lines 173–190)

New mobile menu order:
1. **Turnitin Report** → `/`
2. **Pricing** → `/pricing` (kept)
3. **Sign In** → `/auth` (text link)
4. **Sign Up** → `/auth` (solid green pill button, full width)

(Removed: AI Detector link.)

When `user` is logged in, replace the Sign In / Sign Up rows with a single **Dashboard** button → `/dashboard`.

Desktop top-nav links (visible from md+) are **not changed** in this round per the user's wording ("in side menu") — only the mobile sheet is modified.

### Files
**Edit**
- `src/pages/Landing.tsx` — hero typography classes, subtitle bold-span split, mobile Sheet menu items
- `src/i18n/locales/en/landing.json` — `ready.subtitle`, `faq.a3` text only

### Out of scope
- Theme tokens, other pages, dashboard, footer, desktop nav, other locales.
- No new components or routes.

### Verification (after build)
- View `/` at 411px and 1280px: hero badge is solid blue pill, "Submit Your Paper" is light gray, "Get Your Full Turnitin Report" is bold green, subtitle has bold "exact same report".
- Open mobile hamburger → menu shows Turnitin Report, Pricing, Sign In, Sign Up (no AI Detector).
- "Credits never expire" no longer appears anywhere on `/`.
