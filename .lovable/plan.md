

## Plan: Integrate AI Humanizer Across Site & Add Post-Humanization CTA

### Changes

#### 1. **`src/components/Navigation.tsx`** — Add "AI Humanizer" link to public nav
- Add `{ href: "/ai-humanizer", label: "AI Humanizer", isRoute: true }` to `navLinks` array (before Pricing)

#### 2. **`src/pages/Landing.tsx`** — Add AI Humanizer section to landing page
- Add a new section before the final CTA section promoting the free AI Humanizer tool with a "Try AI Humanizer" button linking to `/ai-humanizer`

#### 3. **`src/components/DashboardSidebar.tsx`** — Add AI Humanizer to customer sidebar
- Add `{ to: '/ai-humanizer', icon: Sparkles, label: 'AI Humanizer' }` to `customerLinks` array (after "My Documents", before "Buy Credits")
- Import `Sparkles` icon

#### 4. **`src/pages/AIHumanizer.tsx`** — Post-humanization improvements
- Remove the "Upgrade to Premium" CTA (tool is fully free, no tiers)
- After output is shown, display a **"Human Score" estimate** section (a visual badge showing ~85-95% estimated human score based on mode)
- Below the score, show a strong CTA: "Want to know the **actual AI percentage** detected by Turnitin? Get your content officially checked by our AI detection service" with a button linking to `/dashboard/upload` (for logged-in users) or `/auth` (for guests)
- Update the plagiarism checker CTA to focus on AI scan credit purchase: "Buy AI Scan credits to get your official Turnitin report"

#### 5. **`supabase/functions/humanize-text/index.ts`** — Return estimated human score
- Add an `estimatedHumanScore` field to the response (calculated based on mode: standard=82-88, advanced=88-94, academic=85-91, creative=86-92, +3-5 if increaseHumanScore is on)
- This is a simple random range estimate to encourage users to verify with real AI detection

### Files Modified
1. `src/components/Navigation.tsx`
2. `src/pages/Landing.tsx`
3. `src/components/DashboardSidebar.tsx`
4. `src/pages/AIHumanizer.tsx`
5. `supabase/functions/humanize-text/index.ts`

