

## Plan: Align Similarity Queue UI with AI Scan Queue UI

### Key Differences Found

Comparing `DocumentQueue.tsx` (AI Scan) with `SimilarityQueue.tsx` (Similarity), these are the UI differences:

1. **Stats cards** — Similarity queue has 3 stats cards (Pending, In Progress, Completed Today). AI Scan queue does not.
2. **Header icon** — Similarity queue has a Search icon before the title. AI Scan queue does not.
3. **Bulk Upload** — AI Scan uses Tabs (Queue / Bulk Upload) for inline bulk upload. Similarity queue has a separate nav button to a different page.
4. **Card structure** — AI Scan queue table is in a Card with no CardHeader. Similarity queue has CardHeader with title/description.
5. **Table columns** — AI Scan combines filename + customer name in one "Document" column. Similarity has them as separate columns. Similarity also shows a "Similarity Only" badge per row.
6. **Exclusions column** — AI Scan has an Exclusions column. Similarity does not.

### Changes — `src/pages/SimilarityQueue.tsx`

1. **Remove stats cards** (the 3-card grid for Pending/In Progress/Completed)
2. **Remove Search icon** from the header title
3. **Replace the Bulk Upload nav button** with Tabs (Queue / Bulk Upload) matching AI Scan's pattern, using `<BulkUploadPanel scanType="similarity" compact />`
4. **Remove CardHeader** from the staff/admin queue Card — just use `CardContent` with `p-0`
5. **Merge Customer column into Document column** — show customer name as a secondary line under filename (same pattern as AI Scan)
6. **Remove "Similarity Only" badge** from table rows
7. **Add Exclusions column** matching AI Scan's format
8. **Extract queue content** into a `renderQueueContent()` function for use inside Tabs

### What stays the same
- Customer view (tabs for In Progress / Completed) remains unchanged
- All batch operations, dialogs, and logic remain unchanged
- Edit/Cancel document dialogs remain unchanged

### Files Modified
1. **`src/pages/SimilarityQueue.tsx`** — UI restructuring only, no logic changes

