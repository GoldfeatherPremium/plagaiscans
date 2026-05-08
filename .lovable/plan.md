# External API multi-account: smart routing + dashboard

## Goals
1. Manage all 3 tokens (existing Lovable secret + 2 new DB rows) from one place.
2. Dispatcher automatically picks the account with the **most credits remaining** that still has free concurrency, and skips accounts that are out of credits, expired, disabled, or full.
3. A dedicated admin dashboard shows credits left, concurrency in use, expiry date, and daily usage for each account in real time.
4. Verify the whole flow end-to-end.

---

## 1. Migrate the Lovable-stored token into the table

- Read the existing `SIMILARITYCHECK_API_TOKEN` value (it's the original "Goldfeather" account — confirmed via API probe: `creditsRemaining: 440 / 1570`, `concurrencyLimit: 5`, `expiresAt: 2026-05-22`).
- Insert it as a new row in `external_api_accounts` labelled **"Primary (Goldfeather)"** so it appears alongside the 2 new tokens in the admin UI.
- Keep the secret in Lovable as a last-resort safety net only — code stops reading it for routing decisions.

After this step, you'll see all 3 accounts in the External API tab.

## 2. Smart routing in the dispatcher

Add new columns to `external_api_accounts` so we can route intelligently and display stats without an extra table:

| Column | Purpose |
|---|---|
| `credits_remaining` | last-known credits left (snapshot) |
| `credits_total` | total credits ever |
| `concurrency_limit` | live limit reported by API |
| `current_concurrent` | live in-flight count |
| `daily_limit` / `daily_usage` | API daily caps (often null) |
| `expires_at` | account expiry date |
| `is_active_remote` | the API's own `isActive` flag |
| `last_checked_at` | when we last probed `/account` |
| `last_probe_error` | last error string, if any |
| `client_id` / `account_name` | API-reported metadata for display |

**New dispatch loop (every 1 minute):**

```text
1. Load all enabled accounts from DB.
2. Probe /account for each in parallel (3s timeout). Save snapshot to columns above.
3. Filter out accounts where:
     - probe failed
     - isActive = false
     - expiresAt is in the past
     - creditsRemaining <= 0
     - dailyLimit reached (dailyUsage >= dailyLimit)
     - free slots = (concurrencyLimit - currentConcurrent) <= 0
4. Sort surviving accounts by creditsRemaining DESC.
5. Walk pending documents one by one:
     - assign to top account
     - decrement that account's "free slots" and "creditsRemaining" locally
     - if it hits 0 slots or 0 credits → remove from pool / re-sort
     - move to next document
6. Stamp each document with external_api_account_id, mark as 'queued',
    then fan out to external-api-submit (background).
```

Manual-submit and poll already use the per-document `external_api_account_id`, so they keep working unchanged.

## 3. Health snapshot job

Create a separate edge function `external-api-account-stats` that just probes `/account` for every enabled account and updates the snapshot columns. Runs:
- every minute via cron (so the dashboard stays fresh even when no documents are dispatched), and
- on-demand from the dashboard "Refresh now" button.

This avoids hammering `/account` more than once per minute when both dispatch + dashboard refresh might run together.

## 4. Admin dashboard — "External API Accounts"

New route: **`/dashboard/external-api-accounts`** (admin-only), and a sidebar link under the existing External API section.

Layout:

```text
+-------------------------------------------------------------+
|  Total credits remaining: 1,240   |  In-flight scans: 3/14  |
+-------------------------------------------------------------+
| Account            Credits        Concurrency   Expires     |
| Primary (★)        440 / 1570     1 / 5         13 days     |
| Account #2         500 / 500      0 / 4         29 days     |
| Account #3         300 / 500      2 / 5         29 days     |
+-------------------------------------------------------------+
```

Per-row card shows:
- Label, status badge (Active / Disabled / Expired / Out of credits)
- Credits remaining with a progress bar against `credits_total`
- Concurrency `current / limit` with a progress bar
- Daily usage if API returns one
- Expiry date + relative ("13 days left", red if <7 days)
- Last checked timestamp + last probe error if any
- Inline edit for label, max concurrency cap, enabled switch
- Buttons: **Refresh now**, **Reveal/Hide token**, **Delete**

A summary strip at the top sums credits across all accounts and shows total in-flight scans, plus a "Low credits" warning when total drops below a threshold (e.g. 50).

The existing `External API` tab inside Document Queue keeps the per-document status table and the auto-dispatch toggle. The accounts manager card moves to this new dedicated page (linked from both places).

## 5. End-to-end test

After deploy, I'll:
1. Trigger `external-api-account-stats` manually → confirm all 3 rows get populated with credits/concurrency/expiry.
2. Trigger `external-api-dispatch` with `force: true` and at least 1 pending document → confirm the document gets `external_api_account_id` set to the account with the most credits.
3. Query `external_api_logs` to confirm the submit hit the right token.
4. Open the new dashboard in the preview and verify all numbers render.
5. Temporarily disable the highest-credit account and re-run dispatch → confirm next document goes to the second-best account.

---

## Technical notes

- DB changes: `ALTER TABLE external_api_accounts ADD COLUMN ...` (no destructive changes); existing rows keep working.
- Routing logic lives entirely in `external-api-dispatch/index.ts`; submit & poll are unchanged.
- New cron: `select cron.schedule('external-api-account-stats-every-minute', '* * * * *', ...)`.
- The Lovable-stored secret isn't deleted — left as a fallback so legacy code paths never crash if the table is ever empty.
- No customer-facing changes; admin-only.
