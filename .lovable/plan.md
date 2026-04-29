## Goal

Add a second AI-scan bulk upload pipeline ("V2") that does **post-upload matching using the document name printed on the cover page** of each Turnitin PDF — instead of matching by uploaded filename. The existing V1 pipeline (`/dashboard/bulk-upload` + `process-bulk-reports`) stays exactly as-is.

## Scope (only this, no scope creep)

- New page, new edge function, new sidebar link.
- Same UI, same drag/drop, same ZIP extraction, same progress, same result panels, same permissions, same notifications, same completion logic.
- **Only difference**: matching keys come from the PDF first-page text, not from the uploaded filename.

## Files to create

### 1. `src/pages/AdminBulkReportUploadV2.tsx`
Direct copy of `src/pages/AdminBulkReportUpload.tsx` with these adjustments:
- Page title: `"Bulk Report Upload V2"` (admin) / `"AI Reports Bulk Upload V2"` (staff).
- Subtitle: "Reports are matched after upload by reading each PDF's cover page."
- **Remove** the pre-upload match preview UI: `matchStats` memo, the "Match Preview" card, the `MatchPreviewDialog`, the `previewMatches` import, the `manualMappings` state, and the `handlePreviewConfirm` handler. (Matching only happens server-side after upload now, so previewing client-side is meaningless.)
- Remove the `pendingDocuments` query — no longer needed for preview.
- The "Process Reports" button calls `supabase.functions.invoke('process-bulk-reports-v2', { body: { reports: uploadedReports } })`.
- Result panels (mapped / unmatched / needs review / completed) stay identical to V1 — they already display by `fileName`, which works for both pipelines.

### 2. `supabase/functions/process-bulk-reports-v2/index.ts`
Direct copy of `supabase/functions/process-bulk-reports/index.ts` with one logical change in the matching layer:

**New step before matching, per report:**
1. Download PDF from `reports` bucket (already done for analysis).
2. Extract text from **page 1** via `pdfjs-serverless` (`extractPageText(pdf, 1)`).
3. Run `extractDocumentNameFromCoverPage(text)` to find the original document filename printed on the cover. Strategies (in order):
   - Regex for an explicit label: `/(?:submission\s*(?:title|name)|document\s*(?:title|name)|file\s*name|paper\s*title)\s*[:\-]?\s*([^\n\r]{1,200})/i`
   - Regex for any token ending in a known extension: `/([\w\-.()\[\]\s]{1,200}\.(?:docx?|pdf|txt|rtf|odt))/i` — pick the first match that isn't the report's own file path.
   - Fallback: take the first non-empty, non-boilerplate line of page 1 (skip lines containing "turnitin", "originality report", "similarity report", "page", "submitted to", purely numeric lines, percentage-only lines).
4. Normalize the extracted name with the existing `normalizeFilename()` helper — this is the **matching key** instead of `normalizeFilename(report.fileName)`.
5. Feed that key into the existing exact-then-fuzzy matcher (`docsByNormalized` / `findBestMatch`). Everything downstream — slot assignment, percentage extraction, `needs_review`, `unmatched_reports` insert, completion + notifications — is unchanged.

**Improved-reliability features added to V2:**
- If cover-page extraction returns nothing, **fall back** to `normalizeFilename(report.fileName)` (so V2 is never worse than V1).
- Lower the auto-assign fuzzy threshold to `>= 85` (vs V1's `90`), since cover-page extraction is noisier.
- Persist the extracted cover name into `unmatched_reports.suggested_documents` payload as `extracted_cover_name` so admins can see what the parser found when reviewing a miss.
- Log both `report.fileName` and `extractedCoverName` for every report (helps debugging).

**Untouched in V2:**
- All PDF type/percentage analysis (`analyzePdf`, `analyzeModernView`, `analyzeClassicalView`, `bruteForceScan`).
- Auth/role check (admin or staff).
- Storage bucket (`reports`).
- Tables written to (`documents`, `unmatched_reports`).
- Completion notifications (user notification, push, completion email, guest completion email).

### 3. `supabase/config.toml`
Append:
```
[functions.process-bulk-reports-v2]
verify_jwt = false
```

### 4. `src/App.tsx`
- Add lazy import: `const AdminBulkReportUploadV2 = lazy(() => import("./pages/AdminBulkReportUploadV2"));`
- Add route alongside existing one:
  `<Route path="/dashboard/bulk-upload-v2" element={<ProtectedRoute allowedRoles={['admin','staff']}><AdminBulkReportUploadV2 /></ProtectedRoute>} />`

### 5. `src/components/DashboardSidebar.tsx`
Add a new entry **next to** (not replacing) each existing AI bulk-upload link:
- Staff section: `{ to: '/dashboard/bulk-upload-v2', icon: FileStack, label: 'Bulk Upload AI V2' }`
- Admin section: `{ to: '/dashboard/bulk-upload-v2', icon: FileStack, label: 'Bulk Upload AI V2' }`

## Files explicitly NOT touched

- `src/pages/AdminBulkReportUpload.tsx`
- `supabase/functions/process-bulk-reports/index.ts`
- `supabase/functions/bulk-report-upload/index.ts`
- `src/pages/AdminSimilarityBulkUpload.tsx`
- `supabase/functions/process-similarity-bulk-reports/index.ts`
- `src/components/MatchPreviewDialog.tsx`, `src/utils/filenameMatching.ts` (V1 still uses them)
- All notification, document, credit, RLS, and DB schema code

## Technical details (for reviewers)

### Cover-page name extraction pseudocode
```ts
function extractDocumentNameFromCoverPage(pageOneText: string, ownPath: string): string | null {
  const text = pageOneText.replace(/\s+/g, ' ').trim();

  // 1. Explicit label
  const labelRe = /(?:submission\s*(?:title|name)|document\s*(?:title|name)|file\s*name|paper\s*title)\s*[:\-]?\s*([^\n\r|]{1,200}?)(?:\s{2,}|$)/i;
  const labelMatch = text.match(labelRe);
  if (labelMatch?.[1]) return labelMatch[1].trim();

  // 2. Token ending in a known doc extension
  const extRe = /([^\s|]{1,200}\.(?:docx?|pdf|txt|rtf|odt))/i;
  const allExt = [...text.matchAll(new RegExp(extRe, 'gi'))]
    .map(m => m[1])
    .filter(name => !ownPath.toLowerCase().includes(name.toLowerCase()));
  if (allExt.length) return allExt[0];

  // 3. First meaningful line
  const lines = pageOneText.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
  const skip = /^(turnitin|originality report|similarity report|ai report|page \d+|submitted to|\d+%?|by\s+)/i;
  const candidate = lines.find(l => l.length >= 3 && l.length <= 200 && !skip.test(l));
  return candidate ?? null;
}
```

### Matching key swap (single call site change)
```ts
// V1:
const normalizedFilename = normalizeFilename(report.fileName);

// V2:
const coverPageText = await extractPageText(pdf, 1);
const extractedCoverName = extractDocumentNameFromCoverPage(coverPageText, report.filePath);
const matchKey = extractedCoverName ? normalizeFilename(extractedCoverName) : normalizeFilename(report.fileName);
const normalizedFilename = matchKey;  // rest of code is identical
```

### Verification checklist after implementation
- V1 page `/dashboard/bulk-upload` still loads, still shows match preview, still completes uploads via `process-bulk-reports`.
- V2 page `/dashboard/bulk-upload-v2` loads, has no preview UI, accepts PDFs/ZIPs, calls `process-bulk-reports-v2`.
- A V2 upload with a renamed file (e.g. `report_xyz.pdf` whose cover page says `Essay_Final.docx`) matches against a queue document named `Essay_Final.docx`.
- A V2 upload whose cover page can't be parsed falls back to filename matching (parity with V1).
- Both edge functions appear in deployed function list; both have `verify_jwt = false`.
- No edits in `src/pages/AdminBulkReportUpload.tsx` or `supabase/functions/process-bulk-reports/index.ts`.