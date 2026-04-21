

## Sample Document — Virtual "First Document" for Every Customer

A built-in sample document that appears as the **first row** in every customer's "My Documents" list (existing customers, brand-new signups, and zero-credit users). It demos a real similarity report and AI report so prospects can see exactly what they get — driving signups and conversions for users with no credits.

### What the customer sees

```text
My Documents
┌────┬───────────────────────────────┬──────────┬─────────┬─────────┬──────────┬──────────┐
│ #  │ Document                      │ Status   │ Sim %   │ AI %    │ Sim Rpt  │ AI Rpt   │
├────┼───────────────────────────────┼──────────┼─────────┼─────────┼──────────┼──────────┤
│ ★  │ Sample.docx     [SAMPLE]      │ Done     │  12%    │  18%    │ Download │ Download │
│ 1  │ <their first real doc>        │ ...      │ ...     │ ...     │ ...      │ ...      │
└────┴───────────────────────────────┴──────────┴─────────┴─────────┴──────────┴──────────┘

A muted helper line above the table:
  "👇 Try downloading our sample reports to see exactly what you'll get."
  (For zero-credit users only:)  "Ready for the real thing? [Buy credits →]"
```

It is **non-deletable, non-editable, non-cancellable**, never consumes credits, and never enters staff queues.

### Architecture

A **single admin-managed sample**, served virtually — not seeded into every user's row. This keeps the database clean (no per-user duplicates), avoids RLS/cancellation/cleanup edge cases, and lets the admin swap the sample any time without touching user data.

```text
┌─────────────────────────┐
│  admin/sample-document  │  (admin uploads once)
└───────────┬─────────────┘
            │ writes
            ▼
┌─────────────────────────┐         ┌────────────────────┐
│  site_settings rows:    │         │  storage:          │
│  - sample_doc_name      │ ──────▶ │  documents/sample/ │
│  - sample_doc_path      │         │  reports/sample/   │
│  - sample_sim_path      │         └────────────────────┘
│  - sample_ai_path       │
│  - sample_sim_pct       │
│  - sample_ai_pct        │
│  - sample_enabled       │
└───────────┬─────────────┘
            │ read by
            ▼
┌─────────────────────────┐
│  useDocuments() hook    │
│  prepends a virtual     │
│  Document to the list   │
│  (id = "sample")        │
└─────────────────────────┘
```

### Database

New rows in the existing `site_settings` table (no schema change required if `site_settings` exists as key/value). Otherwise add 7 settings keys via migration:

```text
sample_enabled        boolean  default true
sample_file_name      text     'Sample.docx'
sample_file_path      text     storage path in 'documents' bucket
sample_sim_path       text     storage path in 'reports' bucket
sample_ai_path        text     storage path in 'reports' bucket
sample_sim_percentage numeric  e.g. 12
sample_ai_percentage  numeric  e.g. 18
sample_remarks        text     optional preset remark
```

A signed-URL RPC (`get_sample_signed_urls`) returns short-lived URLs to any authenticated user so the existing storage RLS stays untouched.

### Frontend changes

**Admin Settings → new "Sample Document" tab** (`src/pages/AdminSettings.tsx`)
- Three file inputs: original document, similarity report PDF, AI report PDF.
- Two number inputs: similarity %, AI %.
- Text area: optional remarks.
- Toggle: enable/disable sample globally.
- Saves files to `documents/sample/` and `reports/sample/`, persists settings, replaces the previous sample on re-upload.

**`src/hooks/useDocuments.ts`**
- After fetching real documents, fetch the sample settings (cached, single call).
- If `sample_enabled` and `role === 'customer'`, prepend a virtual `Document`:
  ```ts
  {
    id: 'sample',
    file_name: 'Sample.docx',
    status: 'completed',
    similarity_percentage: 12,
    ai_percentage: 18,
    similarity_report_path: 'sample/sample_similarity.pdf',
    ai_report_path: 'sample/sample_ai.pdf',
    is_sample: true,        // <-- new flag
    ...
  }
  ```
- Hidden for staff/admin and guests.

**`src/pages/MyDocuments.tsx`**
- Render the sample row with a small `[SAMPLE]` badge next to the filename.
- Hide checkbox, Edit, and Delete actions for the sample row.
- Use a special `★` marker in the `#` column (so real doc numbering stays correct).
- Helper line above the table when `documents.length === 1` (only the sample) **and** customer has zero credits, with a "Buy credits →" link to `/dashboard/buy-credits`.

**`useDocuments.downloadFile`**
- Already supports arbitrary bucket paths; the sample reports are downloaded via the same `reports` bucket signed URL (or the new RPC if RLS blocks anon access). No change needed if reports bucket has a select policy for authenticated users; otherwise add a tiny policy: authenticated users can read objects under `sample/`.

**Soft-delete / edit / cancel guards**
- `deleteDocument`, `EditCompletedDocumentDialog`, `CancelDocumentDialog` all early-return if `id === 'sample'` (defensive — UI already hides the buttons).

### Edge cases

| Scenario | Behavior |
| --- | --- |
| Brand-new signup, 0 credits | Sees only the sample row + "Buy credits" nudge. |
| Existing customer with docs | Sample appears at row #★, real docs keep their numbering. |
| Staff / Admin viewing queues | Sample is invisible — never enters queues, never assignable. |
| Bulk download "Select All" | Sample is excluded (no checkbox). |
| Magic-link guest pages | Sample is hidden (no profile/role). |
| Admin disables sample | Disappears from every customer instantly (next fetch). |
| Admin replaces sample files | Old files overwritten via `upsert: true`; all users see the new sample on next page load. |

### Files touched

```text
supabase/migrations/<new>     add 7 site_settings rows + helper RPC + (optional) reports policy
src/pages/AdminSettings.tsx   new "Sample Document" tab
src/hooks/useDocuments.ts     fetch sample settings, prepend virtual doc, guard delete
src/pages/MyDocuments.tsx     [SAMPLE] badge, hide actions, helper nudge for 0-credit users
src/components/EditCompletedDocumentDialog.tsx   no-op guard for id='sample'
src/components/CancelDocumentDialog.tsx          no-op guard for id='sample'
src/i18n/locales/{7 langs}/dashboard.json        new keys for badge, helper text, admin tab
mem://features/admin/sample-document             new memory file
```

