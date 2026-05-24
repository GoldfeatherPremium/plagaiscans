
# Drillbit Integration + Dashboard Refresh

Adds two new scan products (Drillbit Plagiarism, Drillbit + AI), keeps the existing Turnitin scans, and reorganizes the customer flow under two provider tabs.

## 1. Data model (one migration)

Extend `profiles`:
- `drillbit_credit_balance integer not null default 0` — Drillbit + AI scans
- `drillbit_similarity_credit_balance integer not null default 0` — Drillbit plagiarism only

Extend `documents.scan_type` allowed values to add:
- `drillbit_full` (Drillbit plagiarism + AI)
- `drillbit_similarity_only` (Drillbit plagiarism only)

(Existing `full` and `similarity_only` stay = Turnitin.)

Extend `credit_validity.credit_type` and `credit_transactions.credit_type` to accept `drillbit_full` and `drillbit_similarity`.

Update DB functions:
- `consume_user_credit` — add branches for the two new credit types, locking and decrementing the right balance column.
- `validate_document_upload_credits` — add branches that check Drillbit balances when `scan_type` is one of the new values.

Extend `staff_settings.assigned_scan_types` so admins can assign Drillbit queues to staff (same array column, new string values).

## 2. Customer-facing flow

**New unified entry point:** `/upload` (rebuild current upload landing)
- Two tabs: **Turnitin Detection** and **Drillbit Detection**
- Each tab shows a short description + a single "Start" button
- Clicking opens a dialog with two choices:
  1. Plagiarism only
  2. Plagiarism + AI detection
- Selection routes to the matching upload page:
  - `/upload-turnitin-similarity` (existing `/upload-similarity`)
  - `/upload-turnitin-full` (existing `/upload`)
  - `/upload-drillbit-similarity` (new)
  - `/upload-drillbit-full` (new)

The two new Drillbit upload pages are clones of the Turnitin ones, posting `scan_type = drillbit_*` and checking the Drillbit balances.

## 3. Pricing & checkout

`/pricing` (and `/buy-credits`) gets 4 product categories instead of 2:
- Turnitin – AI + Similarity (existing `full`)
- Turnitin – Similarity only (existing `similarity_only`)
- Drillbit – AI + Similarity (new `drillbit_full`)
- Drillbit – Similarity only (new `drillbit_similarity`)

Admin pricing page (`/admin/pricing`) gets two new tabs for managing Drillbit packages. Checkout/credit-grant flow extended to credit the right balance + create matching `credit_validity` rows.

## 4. Staff & admin queues

New pages mirroring existing Turnitin queues:
- `/staff/drillbit-queue` (plagiarism + AI)
- `/staff/drillbit-similarity-queue`
- `/admin/drillbit-bulk-upload` (manual report PDF upload — same flow as Turnitin bulk v2)
- `/admin/drillbit-similarity-bulk-upload`

Sidebar links added for staff/admin, gated by `assigned_scan_types`.

Document queue hooks (`useDocuments`, `useSimilarityDocuments`) get scan-type filters so each queue only shows its provider's docs.

## 5. Customer dashboard refresh

Pending: waiting for your sample dashboard image. The user said they'll share one. **Plan will be updated after you share it.** For now, the minimum confirmed change is:
- Remove the "Pending" and "Completed" count cards
- Add Drillbit credit balance card(s) alongside the existing Turnitin balances
- Header credit pills extended to show Drillbit balances too

## 6. Routing, i18n, sidebar

- New routes added in `App.tsx`
- Sidebar (`DashboardSidebar.tsx`) gets new entries for customers, staff, admin
- Locale files (`en` first, others get English fallback strings) updated with new keys for tab labels, dialog, queue names

## 7. What is NOT in this plan (explicit)

- No Drillbit API integration — reports are uploaded manually by staff via bulk PDF upload (same as Turnitin v2).
- No browser extension changes.
- No changes to existing Turnitin upload behavior or existing balances.

## Technical notes

- Realtime patcher in `useDocuments`/`useSimilarityDocuments` extended so Drillbit queues update instantly (same pattern as the prior fix).
- `consume_user_credit` keeps FIFO via `deduct_credit_validity` trigger by passing `credit_type = 'drillbit_full' | 'drillbit_similarity'`.
- Edge functions that grant credits (Paddle / Stripe / manual payments) get a `credit_type` switch on the package row to know which balance column to bump.

## Build phasing

1. Migration (separate approval step).
2. Customer tabs + dialog + 4 upload pages + pricing/buy-credits expansion + sidebar.
3. Staff queues + admin bulk-upload pages.
4. Dashboard refresh — **after you share the sample image**.

---

**Please share the sample dashboard image** so I can finalize section 5 before I start building. After you reply with the image (or "go ahead, just remove pending/complete cards and add Drillbit balances"), I'll run the migration and begin phase 1.
