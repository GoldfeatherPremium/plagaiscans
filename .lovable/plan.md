## Reseller API Integration System

A complete API for external reseller sites to submit AI-only scans, with prepaid credits, webhooks, polling, and full admin management.

### Database (1 migration)

New tables:
- **`resellers`** — name, contact_email, status (active/suspended), credit_balance, total_credits_purchased, total_credits_used, webhook_url, webhook_secret, notes, created_by
- **`reseller_api_keys`** — reseller_id, key_hash (sha256), key_prefix (first 8 chars, shown in UI), label, last_used_at, revoked_at, expires_at
- **`reseller_credit_transactions`** — reseller_id, amount, balance_before, balance_after, type (topup/deduction/refund/adjustment), description, performed_by, scan_id
- **`reseller_scans`** — reseller_id, api_key_id, external_reference (reseller's own ID), document_id (links to existing `documents` table), status, ai_percentage, ai_report_path, error, created_at, completed_at, ip_address
- **`reseller_webhook_logs`** — reseller_id, scan_id, url, payload, response_status, response_body, attempt_number, succeeded, next_retry_at, created_at
- **`reseller_api_logs`** — reseller_id, api_key_id, method, path, status_code, ip, user_agent, request_size, response_time_ms, created_at

Helper functions:
- `consume_reseller_credit(reseller_id, scan_id, description)` — atomic FIFO-style deduction, inserts transaction
- `topup_reseller_credits(reseller_id, amount, description, performed_by)` — admin top-up
- `is_admin()` reuse existing `has_role` for RLS

RLS: only admins can read/write reseller tables. Edge functions use service role to bypass RLS.

### Edge Functions (new, all `verify_jwt = false`, custom auth via API key header)

- **`reseller-api`** — single function routing all reseller endpoints by path:
  - `POST /scans` — submit (multipart: file + optional excludeBibliography/excludeQuotes/excludeCitations/minWords + external_reference). Validates API key, checks credits, uploads to `documents` storage bucket, creates `documents` row with `scan_type='ai_only_reseller'`, creates `reseller_scans` row, deducts 1 credit, dispatches to `external-api-submit`. Returns `{ scan_id, status: 'queued' }`.
  - `GET /scans/{id}` — poll status. Returns scan info + (when completed) signed AI report download URL valid 1h.
  - `GET /scans/{id}/report` — direct redirect to signed download URL.
  - `GET /account` — credit balance, usage stats.
  - `GET /scans` — list scans (paginated, filterable by status/date).
- **`reseller-webhook-dispatch`** — internal: called when a reseller scan completes; POSTs JSON `{ scan_id, external_reference, status, ai_percentage, report_url }` with header `X-Plagaiscans-Signature: sha256=<hmac>` (signed with reseller's webhook_secret). Logs every attempt. Retries with exponential backoff (1m, 5m, 30m, 2h, 12h) up to 5 attempts.
- **`reseller-webhook-retry`** — cron (every minute): retries pending webhook deliveries.

Hook into existing `external-api-poll`: when a `reseller_scans`-linked document completes, mark the reseller_scan completed, trigger `reseller-webhook-dispatch`.

### Admin UI

New section "Resellers" in admin sidebar with subpages:
- **`/admin/resellers`** — list all resellers (name, status, balance, total used, last activity, actions: edit/suspend/view)
- **`/admin/resellers/new`** — create reseller form
- **`/admin/resellers/:id`** — detail with tabs:
  - **Overview** — info, status toggle, edit, webhook URL & rotate secret
  - **API Keys** — create key (shows full key once, then prefix only), revoke, label, last used
  - **Credits** — current balance, top-up form, transaction history
  - **Scans** — list of all scans by this reseller with status/score/links to report
  - **API Logs** — recent API requests with method/path/status/IP
  - **Webhook Logs** — delivery attempts, status, payloads, retry now button

Single AdminResellers route added to `App.tsx` admin section, protected by `useUserRole` admin check.

### Documentation

Public docs page `/api-docs` (linked from footer) with:
- Authentication (X-API-Key header)
- Endpoints with curl + JS examples
- Webhook payload format and signature verification
- Error codes table
- Credit & rate-limit info

### Notes

- AI scan only — no similarity_only path. `scan_type='ai_only_reseller'` is filtered out from existing customer/staff queues.
- Documents from resellers are excluded from regular `Dashboard`/`MyDocuments`/`DocumentQueue`/`SimilarityQueue` views (filter `scan_type != 'ai_only_reseller'` or `magic_link_id is null AND user_id is null AND reseller_id is set` — we'll add a guard in those queries).
- API key shown once on creation (toast + copy button). Stored only as sha256 hash.
- Rate limiting: simple in-memory per-key counter inside `reseller-api` (60 req/min) to start; documented as such.
- Webhook signature: `sha256=HMAC_SHA256(webhook_secret, raw_body)`.

### Files

Created:
- 1 migration
- `supabase/functions/reseller-api/index.ts`
- `supabase/functions/reseller-webhook-dispatch/index.ts`
- `supabase/functions/reseller-webhook-retry/index.ts`
- `src/pages/AdminResellers.tsx`
- `src/pages/AdminResellerDetail.tsx`
- `src/pages/ApiDocs.tsx`
- `src/hooks/useResellers.ts`

Modified:
- `supabase/functions/external-api-poll/index.ts` — trigger reseller webhook on completion
- `supabase/functions/external-api-dispatch/index.ts` — include reseller scans in dispatch (already filters by scan_type != similarity_only, fine)
- `supabase/config.toml` — register new functions
- `src/App.tsx` — routes
- `src/components/DashboardSidebar.tsx` — admin nav item
- `src/components/Footer.tsx` — link to /api-docs
- Existing query files (Dashboard, MyDocuments, DocumentQueue) — exclude reseller scans

### Out of scope (can add later)

- Self-serve reseller signup portal
- OAuth2 client_credentials flow (deferred — API key sufficient for v1)
- Per-reseller custom AI exclusion defaults
- Reseller-facing dashboard (this is API-only; admin manages everything)
