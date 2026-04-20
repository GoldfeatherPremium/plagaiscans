

## Add Thesis Elite Backlinks (SEO Partner Section)

Add a "Recommended for Researchers" partner card to the global Footer plus contextual in-context backlinks on the customer documents page and the existing blog post. Also create a new dedicated blog post that naturally links to Thesis Elite.

### 1. Footer partner card — appears on every page
Edit `src/components/Footer.tsx`. Insert a new section directly above the "Paddle MoR Statement" block (and above the bottom copyright line):

- A single bordered Card titled **"Recommended for Researchers"** (small label) with:
  - Heading: **"Need help beyond plagiarism checks?"**
  - Body: *"Thesis Elite supports PhD scholars with thesis editing, journal publication, patent filing, and research assistance across 20+ countries."*
  - CTA button: **"Visit Thesis Elite →"** → `https://thesiselite.com`, `target="_blank"`, `rel="noopener"` (no `nofollow`).

### 2. Contextual backlink on customer documents area
Edit `src/pages/MyDocuments.tsx` — add a small dismissible-looking info card at the top (below the page header, above the table) that's only shown when `role === 'customer'`:

- Headline: **"Got a high AI or similarity score?"**
- Body: *"Reduce AI-generated content and improve originality with [research support for PhD scholars] from Thesis Elite — covering thesis editing, paraphrasing assistance, and journal-ready revisions."* (anchor `research support for PhD scholars` → `https://thesiselite.com`, `rel="noopener"`)

This single placement covers both customer "AI scan" and "similarity" results since `MyDocuments` is the unified customer view of both scan types. (The staff-facing `DocumentQueue` and `SimilarityQueue` pages are intentionally NOT touched — staff/admin pages shouldn't carry external promo backlinks.)

### 3. New blog post — most relevant placement
Create `src/pages/BlogAfterPlagiarismReport.tsx` titled **"After the Plagiarism Report: Next Steps for PhD Scholars"** with:

- SEO meta + Article structured data
- 4–5 sections: interpreting the report, common high-similarity causes, paraphrasing vs. citation, when to seek expert help, conclusion
- One natural in-paragraph link in the "when to seek expert help" section using anchor text **"professional thesis editing and publication support"** → `https://thesiselite.com` (`rel="noopener"`)
- Footer

Wire route `/blog/after-plagiarism-report` in `src/App.tsx` (lazy-loaded, public route).

### 4. Reinforce existing blog post
Edit `src/pages/BlogWhatIsPlagiarism.tsx` — add one short paragraph near the end (before the FAQ) that naturally links **"thesis editing and journal publication services"** → `https://thesiselite.com` (`rel="noopener"`). Different anchor text from the new post to avoid duplication.

### 5. Sitemap
Edit `public/sitemap.xml` — add `<url>` entry for `/blog/after-plagiarism-report` (priority 0.7, weekly).

### Anchor text distribution (no exact-match spam)
| Location | Anchor text | Type |
|---|---|---|
| Footer CTA button | Visit Thesis Elite → | Branded |
| MyDocuments card | research support for PhD scholars | Descriptive |
| New blog post body | professional thesis editing and publication support | Descriptive |
| Existing blog post body | thesis editing and journal publication services | Descriptive |

All links use `rel="noopener"` only (no `nofollow`) and `target="_blank"`.

### Files
- Edit: `src/components/Footer.tsx`
- Edit: `src/pages/MyDocuments.tsx`
- Edit: `src/pages/BlogWhatIsPlagiarism.tsx`
- Edit: `src/App.tsx` (add route)
- Edit: `public/sitemap.xml`
- New: `src/pages/BlogAfterPlagiarismReport.tsx`

