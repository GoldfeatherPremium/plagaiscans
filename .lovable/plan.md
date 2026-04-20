
## Redesign Landing Page to Match reilaa.com/turnitin-report Style

I'll fetch the reference site to capture its exact theme, layout, and content patterns, then rebuild the PlagaiScans landing page to match — keeping our brand name, our routes, our backend, and our compliance-required wording (no Turnitin trademark).

### What I'll change

**1. Theme tokens (`src/index.css` + `tailwind.config.ts`)**
- Update color palette, fonts, radii, and shadows to match reilaa.com's look (likely a clean white/light background with a single bold accent color, large display headings, generous spacing).
- Keep dark mode support but re-tune to match.
- All colors stay as HSL semantic tokens (no hardcoded hex in components).

**2. Landing page sections — rebuild to mirror reilaa.com/turnitin-report**

Replace/update these existing components used on `src/pages/Landing.tsx`:
- `HeroSection.tsx` — large centered hero with bold headline, subhead, primary CTA + secondary CTA, trust line (e.g. "Used by researchers worldwide"), and a visual mock/screenshot block underneath.
- `AboutSection.tsx` → "Why PlagaiScans" — feature highlights in a clean grid matching reilaa's card style.
- `ServicesSection.tsx` → "What you get" — similarity report, source matches, content analysis indicators, secure handling, fast turnaround, bulk uploads.
- New `HowItWorksStrip.tsx` — 3-step horizontal flow (Upload → Scan → Get Report) styled like reilaa's process strip.
- New `SampleReportSection.tsx` — visual block showing a sample report card (no real Turnitin imagery — generic similarity-report mock).
- New `TrustSection.tsx` — quick stats / "trusted by" strip (documents scanned, languages supported, countries served — pulled from existing copy in `useCases`/`about` translations).
- New `FAQStrip.tsx` — short 4–6 Q&A accordion at the bottom of landing (uses existing FAQ translation keys).
- Existing `ContactSection.tsx` retained at the bottom.

**3. Landing page composition (`src/pages/Landing.tsx`)**
Section order to mirror the reference:
```text
Navigation
Hero (centered, large)
Trust strip (mini logos / counters)
How It Works (3 steps)
What You Get (features grid)
Sample Report visual
Why Choose Us (about)
FAQ strip
Contact / CTA
Footer
```

**4. Branding & compliance guardrails (unchanged)**
- Keep brand name **PlagaiScans** everywhere — never copy "Turnitin" from the reference site (trademark policy).
- Use neutral terminology: "Similarity Review", "Content Analysis Indicators".
- No pricing on landing page (existing constraint).
- Footer's existing **Thesis Elite** partner card stays as-is.
- All existing routes, auth flow, dashboard untouched.

**5. Translations**
Reuse existing `landing.json` keys; only add new keys for the brand-new sections (trust strip, sample-report, how-it-works strip). English first; other locales fall back to English until you ask for full translation.

**6. Responsiveness**
Mobile-first (current viewport 411px confirmed). Hero stacks, grids collapse to 1 column, CTAs full-width on mobile.

### Files
**Edit**
- `src/index.css` — theme tokens
- `tailwind.config.ts` — font family, extended colors if needed
- `src/pages/Landing.tsx` — section composition
- `src/components/HeroSection.tsx` — restyle + recenter
- `src/components/AboutSection.tsx` — restyle
- `src/components/ServicesSection.tsx` — restyle
- `src/i18n/locales/en/landing.json` — new keys

**Create**
- `src/components/landing/HowItWorksStrip.tsx`
- `src/components/landing/SampleReportSection.tsx`
- `src/components/landing/TrustSection.tsx`
- `src/components/landing/FAQStrip.tsx`

### Out of scope
- Dashboard, auth, admin, or any logged-in pages — landing page only.
- No copying of any Turnitin branding, product names, or trademarked imagery from the reference site.
- No pricing added to landing page.

### Verification after build
- View `/` on mobile (411px) and desktop — confirm visual parity with reilaa.com/turnitin-report style.
- Confirm all CTAs route to `/auth` or `/how-it-works` correctly.
- Confirm Footer + Thesis Elite card still render.
