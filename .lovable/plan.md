

## Plan: Add Last-20-Pages Fallback to AI Scan Queue PDF Analysis

### Problem
The `process-bulk-reports` edge function (AI scan queue) only reads page 2 of the PDF to extract similarity/AI percentages. Some reports don't have the percentage on page 2 but do have it in the last 20 pages (e.g., in the "ORIGINALITY REPORT" section). The similarity-only queue (`process-similarity-bulk-reports`) already handles this with a fallback -- we need to mirror that logic.

### Change: `supabase/functions/process-bulk-reports/index.ts`

Update the `analyzePdfPage2` function to:

1. **Keep page 2 as first priority** (current behavior, unchanged)
2. **If no percentage found on page 2**, scan the last 20 pages (from the end backwards) looking for:
   - Similarity keywords: "originality report", "similarity index" with percentage patterns
   - AI keywords: "ai writing", "ai detection", "ai-generated" with percentage patterns
3. Use the same pattern matching approach as `process-similarity-bulk-reports`:
   - `origPatterns` for similarity: `/(\d+(?:\.\d+)?)\s*%?\s*similarity\s*index/i`, etc.
   - `aiPatterns` for AI: `/(\d+(?:\.\d+)?)\s*%?\s*ai/i`, etc.

The report type classification (similarity vs AI) still happens on page 2. The fallback only extracts the **percentage** if page 2 didn't yield one.

### Technical Detail
- Rename function from `analyzePdfPage2` to `analyzePdf` to reflect broader scope
- Add `source` field to `ReportAnalysis` interface for debugging (`'page2' | 'last_pages' | 'none'`)
- Scan pages from `numPages` down to `max(1, numPages - 19)` (last 20 pages), same as similarity queue

