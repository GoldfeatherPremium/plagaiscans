

## Plan: Build AI Humanizer Tool Page

### Overview
Create a new public page at `/ai-humanizer` with an interactive AI-powered text humanization tool. The tool uses Lovable AI (via an edge function) to rewrite AI-generated text into natural, human-like writing.

### Files to Create

1. **`src/pages/AIHumanizer.tsx`** — Main page component
   - Hero section with title "Free AI Humanizer Tool" and subtitle
   - Input textarea with word/character counter (max ~1000 words for free usage)
   - Mode dropdown: Standard, Advanced, Academic, Creative
   - "Increase Human Score" toggle (adds more randomness)
   - "Humanize Now" button with loading state ("Humanizing your content...")
   - Output section with humanized text, Copy button, Download as .txt/.docx buttons
   - Trust badges: "AI Detection Optimized", "Academic Submission Ready", "Free Basic Usage"
   - Marketing lines: "Used by students & professionals", "100% free basic usage"
   - Upgrade CTA: "Need more words? Upgrade to Premium on Plagaiscans"
   - "Check plagiarism with Plagaiscans" CTA linking to `/plagiarism-checker`
   - FAQ section with relevant questions
   - SEO component with proper title/meta/structured data
   - Uses Navigation + Footer from existing components
   - Follows existing conservative enterprise SaaS aesthetic (matching brand memory)

2. **`supabase/functions/humanize-text/index.ts`** — Edge function
   - Accepts `{ text, mode, increaseHumanScore }` in request body
   - Input validation with length check (reject > 1000 words for free tier)
   - Calls Lovable AI Gateway (`google/gemini-2.5-flash`) with a carefully crafted system prompt per mode:
     - Standard: balanced rewriting
     - Advanced: strong humanization with more variation
     - Academic: formal academic tone
     - Creative: engaging natural storytelling
   - System prompt instructs: rewrite sentence structures completely, vary sentence length, add natural imperfections, reduce repetitive phrasing, avoid robotic patterns, maintain meaning, add burstiness & perplexity variation
   - "Increase Human Score" flag adds extra randomness instructions to the prompt
   - Safety filter: refuse harmful/explicit content
   - Basic rate limiting via IP-based tracking
   - CORS headers included
   - Handles 429/402 errors from AI gateway gracefully

### Files to Modify

3. **`src/App.tsx`**
   - Add lazy import for `AIHumanizer`
   - Add public route: `<Route path="/ai-humanizer" element={<PublicRoute><AIHumanizer /></PublicRoute>} />`

4. **`public/sitemap.xml`** — Add `/ai-humanizer` entry

### Technical Details

- **No streaming needed** — single request/response via `supabase.functions.invoke()`
- **No login required** — guest usage allowed, no auth check
- **Word limit enforced client-side and server-side** (1000 words)
- **Download .txt** — simple Blob download
- **Download .docx** — use a simple approach with Blob and proper MIME type (plain text in .docx wrapper)
- **Copy** — `navigator.clipboard.writeText()`
- **SEO**: Title "Free AI Humanizer Tool – Reduce AI Detection | Plagaiscans", meta description as specified
- **Careful wording**: "optimized to reduce AI detection" instead of "bypass" claims per the reality check

### Brand Compliance
- Uses existing color scheme (primary blue, dark secondary)
- Conservative enterprise SaaS aesthetic per brand memory
- No trademark references (Turnitin etc.) in the UI — uses generic "AI detection tools" wording
- Trust badges use safe language: "AI Detection Optimized" rather than "Turnitin Safe"

