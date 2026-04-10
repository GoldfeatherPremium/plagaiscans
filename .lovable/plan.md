

## Plan: Fix Similarity Queue & Bulk Upload

### Issue 1: Remove Exclusions Column from Similarity Queue

**`src/pages/SimilarityQueue.tsx`**
- Remove the `<TableHead>Exclusions</TableHead>` header (line 624)
- Remove the `<TableCell>` block rendering Bib/Quotes/Small badges (lines 671-686)

### Issue 2: Similarity Bulk Upload Not Completing Documents

The `process-similarity-bulk-reports` edge function has several gaps compared to the working AI scan version (`process-bulk-reports`):

**Root causes identified:**
1. The document query does not filter `needs_review = false` or `deleted_at IS NULL`, so it may match deleted or flagged documents instead of the correct ones
2. No fuzzy matching — if the filename normalization doesn't produce an exact match, the report goes to "unmatched" even when a close match exists
3. Missing `magic_link_id` in the select query, so guest completion emails cannot be sent
4. No `documentId` manual assignment support (from the preview dialog), so admin manual mappings are ignored

**`supabase/functions/process-similarity-bulk-reports/index.ts`** — align with `process-bulk-reports`:

1. Add `.eq('needs_review', false)` and `.is('deleted_at', null)` filters to the document query
2. Add `magic_link_id` to the select fields
3. Add fuzzy matching logic (same `findBestMatch` approach used in AI scan version) as a fallback when exact match fails
4. Support `report.documentId` for manual assignment from the preview dialog
5. Send guest completion email when `magic_link_id` is present (already sends for registered users)

### Files Modified
1. `src/pages/SimilarityQueue.tsx` — remove Exclusions column
2. `supabase/functions/process-similarity-bulk-reports/index.ts` — fix matching and completion logic

