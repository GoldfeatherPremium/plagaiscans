## Goal

Build a **new** AI-scan bulk upload page (V2) alongside the existing one. Same look, same workflow, same edge function logic — but **matching happens after upload by reading the original filename printed on page 1 of each Turnitin report** (e.g. `file-678337070(8).docx`), not from the report's own filename uploaded by the admin.

Existing `/dashboard/bulk-upload` (AI), its page, and its `process-bulk-reports` edge function are **NOT touched**.

---

## What's new vs. existing flow

| Aspect | Existing (V1) | New (V2) |
|---|---|---|
| Match key source | The report file's **own filename** (e.g. `john_essay.pdf`) | The **original document name printed on page 1** of the PDF (Turnitin "Cover Page" → `file-XXXXXX(8).docx`) |
| Match preview | Done **before** upload (client computes preview from filenames) | Done **after** upload (server extracts page 1, then matches) |
| Pre-upload preview dialog | Yes (`MatchPreviewDialog`) | Removed — replaced by a post-process review step for unmatched items |
| Page used for type/percentage | Page 2 (modern) → last 10 (classical) → brute-force | **Same** (unchanged) |
| Manual reassignment for unmatched | Yes via existing Unmatched Reports page | **Same** (unchanged, reuses `unmatched_reports` table) |

Everything else (ZIP extraction, file list UI, progress bar, completion notifications, push, email, role/permission gate, completion → both reports filled, etc.) is identical.

---

## Files to create

1. **`src/pages/AdminBulkReportUploadV2.tsx`**
   - Copy of `AdminBulkReportUpload.tsx`.
   - Removes pre-upload `MatchPreviewDialog`, `previewMatches`, `matchStats`, `manualMappings`, `pending-full-scan-documents` query, and the "Preview Matches" button.
   - Header text: "Bulk Report Upload V2 (Match by PDF Cover Page)".
   - Description: "Reports are matched after upload by reading the original filename from page 1 of each PDF."
   - Calls new edge function `process-bulk-reports-v2` (no `documentId` overrides — server determines all matches).
   - Result panel still shows mapped / unmatched / completed / needs-review counts and links to the existing Unmatched Reports admin page.

2. **`supabase/functions/process-bulk-reports-v2/index.ts`**
   - Copy of `process-bulk-reports/index.ts`.
   - Adds a new step **before** the existing fuzzy matcher: extract page 1 text, parse the original filename printed there, normalize it, and use **that** as the match key instead of the uploaded report's filename.
   - Page 1 extraction logic (Turnitin cover page format):
     - Pull text from page 1 via existing `extractPageText(pdf, 1)`.
     - Look for a line matching the original document filename. Strategy:
       1. Regex for any token ending in a known extension: `/([\w\-.()\s]+?\.(?:docx?|pdf|txt|rtf|odt))/i` — pick the **last** match on page 1 (Turnitin prints student name then filename right under it).
       2. If none, fallback regex for `file-\d+(?:\(\d+\))?\.\w+`.
       3. If still none → mark report as **unmatched** with reason "Could not read filename from cover page" and insert into `unmatched_reports` so admin can manually assign.
   - Use the extracted filename (normalized via existing `normalizeFilename`) as the match key fed into the existing exact + fuzzy matcher against `documents.normalized_filename`.
   - Falls back to V1 behavior (matching on uploaded filename) only if explicitly enabled — **not enabled** by default to keep V2 behavior pure.
   - Page 2/classical/brute-force PDF type & percentage detection: **unchanged**.
   - Completion side effects (status → completed, notifications, push, completion email, guest completion email): **unchanged**.

3. **`supabase/config.toml`** — add `[functions.process-bulk-reports-v2]` block mirroring the existing `process-bulk-reports` settings (verify_jwt remains default).

## Files to edit

4. **`src/App.tsx`**
   - Add lazy import for `AdminBulkReportUploadV2`.
   - Add route `/dashboard/bulk-upload-v2` (admin + staff with `can_batch_process`, same guard as V1).

5. **`src/components/DashboardSidebar.tsx`**
   - Under both the staff section (line ~335) and the admin section (line ~368), add a new entry **right below the existing "Bulk Upload (AI)"**:
     - `{ to: '/dashboard/bulk-upload-v2', icon: FileStack, label: 'Bulk Upload AI V2' }`
   - Existing "Bulk Upload (AI)" / "Bulk Upload (Full)" / "Bulk Upload (Sim)" entries stay exactly as they are.

## Files NOT touched

- `src/pages/AdminBulkReportUpload.tsx`
- `src/pages/AdminSimilarityBulkUpload.tsx`
- `supabase/functions/process-bulk-reports/index.ts`
- `supabase/functions/process-similarity-bulk-reports/index.ts`
- `src/components/BulkUploadPanel.tsx`
- `src/components/MatchPreviewDialog.tsx`
- `src/utils/filenameMatching.ts`

---

## Technical detail: page-1 filename extraction

Turnitin Modern View cover page (per the screenshot) prints:

```
Estudiante N/a
file-678337070(8).docx
─────────────────
Document Details
Submission ID  trn:oid:::...
File Name      file-67833-1777361269675.docx     ← internal Turnitin name (ignore)
```

The visible large filename right under the student name is the **original upload name** that we stored on the `documents` row. The "File Name" field in Document Details is Turnitin's internal name — we must **not** use that.

Extraction approach inside the edge function:

```ts
async function extractCoverPageFilename(pdf): Promise<string | null> {
  const text = await extractPageText(pdf, 1);
  // 1. Find all filename-like tokens with known extensions
  const exts = /([^\s\/\\:*?"<>|]+\.(?:docx?|pdf|txt|rtf|odt))/gi;
  const matches = [...text.matchAll(exts)].map(m => m[1].trim());
  if (matches.length === 0) return null;
  // 2. Prefer the FIRST match — it's the prominent one under student name.
  //    Document Details "File Name: ..." appears later in page text.
  return matches[0];
}
```

The chosen filename is then run through the existing `normalizeFilename` and matched against `documents.normalized_filename` using the same exact-then-fuzzy ladder already in V1.

---

## Verification steps after build

1. Visit `/dashboard/bulk-upload-v2` as admin — page renders, V1 page at `/dashboard/bulk-upload` still renders unchanged.
2. Upload a Turnitin PDF whose cover page shows `file-678337070(8).docx` while a pending document with that same `file_name` exists — report auto-maps.
3. Upload a PDF whose cover page filename has no matching document — appears in unmatched list and in Admin → Unmatched Reports for manual assignment.
4. Confirm V1 flow unchanged: upload via `/dashboard/bulk-upload` still uses report-filename-based pre-upload preview.
