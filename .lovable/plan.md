
## Redesign Landing Page to Match reilaa.com Style

I'll redesign the PlagaiScans landing page to mirror the visual style and copy from the reference screenshots. The new layout uses a clean white background, bold dark headings, a green accent color, and the exact section structure shown in the images.

### Theme update
**`src/index.css`** — adjust light theme tokens:
- Background: pure white / very light gray (`#F8FAFC`)
- Foreground: deep navy (`#0B1B2B`)
- Primary accent: green (`#16A34A` / emerald-600) — used for the highlighted heading word, primary CTA button, success icons
- Secondary accent: blue (`#2563EB`) for the "REAL TURNITIN • NO REPOSITORY" pill and the AI Detection icon
- Card backgrounds: white with subtle border, generous rounded corners (`rounded-2xl`)
- Soft pastel icon circles: green-100, blue-100, purple-100 backgrounds for feature icons

### Landing page structure (`src/pages/Landing.tsx`)

Replace current sections with this exact order, using copy from the screenshots:

**1. Hero**
- Blue pill badge: **"REAL TURNITIN • NO REPOSITORY"**
- Heading line 1 (gray): **"Submit Your Paper"**
- Heading line 2 (green): **"Get Your Full Turnitin Report"**
- Subtitle: *"Upload your document or paste text. Get the **exact same report** your professor sees—AI detection and similarity scores included."*
- Dashed-border card with green upload icon containing:
  - **"Submit Your Paper for Analysis"**
  - *"Get your **official Turnitin report** with AI detection and similarity scores."*
  - Primary green button: **"Sign In to Submit"** → `/auth`
  - Outlined green button: **"Create Account"** → `/auth`

**2. "Know What Your Professor Will See" section**
- Heading: **"Know What Your Professor Will See"**
- Subheading: *"Don't submit blindly. Get the same Turnitin analysis your institution uses, with complete AI detection and similarity reports."*
- 3 stacked feature blocks (centered, icon-on-top), each with pastel circle icon:
  - Blue lightning → **AI Detection** — *"Full AI detection report showing exactly which parts of your paper are flagged as AI-generated, with sentence-level highlighting."*
  - Purple document → **Similarity Check** — *"Complete similarity analysis against billions of web pages, academic papers, and student submissions with source links."*
  - Green clock → **Fast Results** — *"Get your complete report in just 2-5 minutes. Perfect for last-minute checks before submission deadlines."*

**3. "What's in Your Full Report" section**
- Heading: **"What's in Your Full Report"**
- Subheading: *"Everything you need for complete peace of mind"*
- Two white bordered cards stacked:
  - **⚡ AI Detection Report** (blue icon) with green checkmark list:
    - Overall AI percentage score matching Turnitin's analysis
    - Sentence-by-sentence highlighting of flagged content
    - Confidence levels for each detection
    - Section-by-section breakdown
  - **📄 Similarity Report** (purple icon) with green checkmark list:
    - Overall similarity percentage score
    - Source URLs for all matching content
    - Matches from academic publications and journals
    - Student paper database matches

**4. "Why Students Trust PlagaiScans" section**
- Heading: **"Why Students Trust PlagaiScans"** (replacing "Reilaa" with our brand — only brand-name swap)
- 4 feature rows with green pastel circle icons (left-aligned icon, text on right):
  - 🛡 **Complete Privacy** — *"Your papers are processed and immediately deleted. No storage, no sharing, no database retention."*
  - ⚡ **Accurate Results** — *"Same detection technology institutions use. Know your real scores before submission."*
  - 🕐 **Fast Turnaround** — *"Get your complete report in 2-5 minutes. Perfect for tight deadlines."*
  - 👥 **Student-Friendly Pricing** — *"Just $3.99 per report. No subscriptions, no recurring charges, no hidden fees."*

**5. "Ready for Your Full Report?" CTA card**
- Light-green tinted card with green border:
  - Heading: **"Ready for Your Full Report?"**
  - Body: *"Get complete AI detection and similarity analysis for just $3.99. Credits never expire."*
  - Primary green button: **"View Pricing"** → `/pricing`
  - Outlined green button: **"Create Free Account"** → `/auth`

**6. FAQ section**
- Heading: **"Frequently Asked Questions"** (keep existing FAQ accordion content)

**7. Footer** (unchanged — keeps Thesis Elite partner card)

### Translation file
Update `src/i18n/locales/en/landing.json` with all new keys for the exact copy above. Other locale files left untouched (will fall back to English keys until you ask to translate).

### Files
**Edit**
- `src/index.css` — green/blue accent palette, white background
- `src/pages/Landing.tsx` — full section rewrite
- `src/i18n/locales/en/landing.json` — new keys for new copy

### Memory updates
- Override the existing **Pricing Visibility Constraint** memory: pricing IS now mentioned on landing ("$3.99 per report" in Why Students Trust + CTA card) per your explicit request.
- Override **Trademark Compliance Policy** memory for the landing page only: per your explicit instruction, the word "Turnitin" is used on the landing page copy.

### Out of scope
- Dashboard, auth, admin, blog pages — landing only.
- No image assets copied from the reference site — only text copy and visual style replication.
- Other locales (de, fr, es, ru, ar, zh) keep existing keys; English landing copy updates only.
