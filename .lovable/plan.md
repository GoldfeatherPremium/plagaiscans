# SendFox Promotional Email Integration

Adds SendFox as the dedicated promotional email channel, fully isolated from the existing SendPulse transactional pipeline. Customer records sync automatically with behavioural tags; unsubscribes flow back into a shared suppression list that only promotional sends respect.

## Architecture

```text
                    ┌─────────────────────────────┐
   profile change ─►│ sync-contact-to-sendfox     │──► SendFox API
   admin "resync"  ─►│  (idempotent, tag compute) │
                    └──────────┬──────────────────┘
                               │ writes
                    ┌──────────▼──────────┐
                    │ sendfox_contacts    │
                    │ sendfox_sync_log    │
                    └─────────────────────┘

   SendFox webhooks ──► sendfox-webhook ──► email_suppressions
                                            (promotional only)

   SendPulse transactional pipeline: UNTOUCHED — always sends.
```

## Database migration

New tables (RLS via existing `has_role(auth.uid(), 'admin')` helper, not `auth.jwt() ->> 'role'`):

- `sendfox_contacts` — `user_id` PK → `auth.users`, `sendfox_contact_id`, `email`, `current_tags text[]`, `last_synced_at`, `sync_status`.
- `email_suppressions` — `email` unique, `reason` (`user_unsubscribe|bounce|complaint|manual`), `source`, `created_at`. Shared across future promo channels.
- `sendfox_sync_log` — append-only audit (`user_id`, `email`, `action`, `status`, `error`, `created_at`).

Indexes on `lower(email)` and `created_at desc`. Admin-only RLS policies for full CRUD on contacts/suppressions and SELECT on log.

Note: the spec's `lifetime_spend`, `total_purchases`, `last_login_at` columns do not exist on `profiles`. Tag computation derives these inside the edge function:

- `total_purchases` / `lifetime_spend` → aggregate from `invoices` where `status = 'paid'` for the user.
- `last_login_at` → fall back to `auth.users.last_sign_in_at` (read via service role).

## Edge function: `sync-contact-to-sendfox`

Idempotent POST handler taking `{ user_id }`.

1. Load `profiles` row (must have email).
2. Short-circuit if email is in `email_suppressions` — log `skip_suppressed`, return.
3. Compute aggregates (paid invoice sum/count) and pull `last_sign_in_at` via `supabase.auth.admin.getUserById`.
4. Compute tag set: `customer|lead`, `low_credits` (<5), `high_value` (≥$100), `active` (≤7d), `inactive_30d` (≥30d or never).
5. Look up existing `sendfox_contacts.sendfox_contact_id`. PATCH if found, else POST `/contacts` with `lists: [SENDFOX_LIST_ID]`.
6. Upsert mapping row + `sendfox_sync_log` success entry.
7. On error: log to `sendfox_sync_log` with `status=failed` and return 500.

Uses `SENDFOX_ACCESS_TOKEN` Bearer auth against `https://api.sendfox.com`. Tags are stored locally; per spec, richer tag-as-list segmentation can be added later by creating SendFox lists per tag.

## Edge function: `sendfox-webhook`

Public POST endpoint (will deploy with `verify_jwt = false` in `supabase/config.toml`).

- Verifies shared secret from `x-webhook-secret` header or `?secret=` query against `SENDFOX_WEBHOOK_SECRET`.
- Parses event, normalises type → reason (`unsubscribe`/`bounce`/`complaint`).
- Upserts into `email_suppressions` and logs.

## Auto-sync wiring

Per spec's fallback note (pg_net + GUC config not standard here), uses **application-level invocation** instead of a DB trigger. We add a tiny client helper `triggerSendfoxSync(userId)` that fires `supabase.functions.invoke('sync-contact-to-sendfox', ...)` and call it from:

- Signup handler (after profile insert succeeds) in `AuthContext.signUp` and the Google OAuth completion path.
- Successful payment webhooks (server-side): `paddle-webhook`, `dodo-webhook`, `paypal-webhook`, `nowpayments`, and the Stripe checkout success handler. We add a single `await fetch` call to the sync function at the end of the credit-grant block (failures are swallowed and logged — never block the payment flow).
- Credit deduction path: after `consume_user_credit`, fire-and-forget sync (debounced client-side to avoid spam — only when balance crosses the <5 threshold).

This keeps `SENDPULSE_*` env vars and every `send-*-email` function completely untouched.

## Admin UI: `/admin/email-sync`

New page (admin-route guarded like other admin pages, using `DashboardLayout`):

- Summary cards: total synced contacts, last sync time, error count (24h).
- Tag breakdown table — counts per tag computed via `sendfox_contacts.current_tags` unnest.
- Last 50 sync log entries with status badges and error tooltips.
- "Force resync all users" button — calls a new `resync-all-sendfox` edge function that paginates `profiles` and invokes `sync-contact-to-sendfox` in batches of 10/sec.
- Suppression list manager — table with manual add (email + reason) and remove.
- Read-only display of configured `SENDFOX_LIST_ID` (fetched via a tiny `get-sendfox-config` function that returns only the list id, never the token).

Built with shadcn/ui + TanStack Query, matching existing admin page patterns.

## Secrets to add

`SENDFOX_ACCESS_TOKEN`, `SENDFOX_LIST_ID`, `SENDFOX_WEBHOOK_SECRET`. `APP_URL` is optional — we already have project URLs available. The user will be prompted to add these via the secrets tool once they generate them in SendFox.

## Documentation

`docs/email/README.md` explaining the dual-pipeline architecture, the SendFox dashboard setup checklist (token, list, webhook URL, sender domain — emphasising "merge SPF, never replace SendPulse DNS"), the trademark constraint on from-addresses, and the testing checklist.

## Out of scope / preserved

- Zero changes to any file matching `sendpulse` (case-insensitive) or any `SENDPULSE_*` secret.
- Transactional emails (receipts, password reset, order confirmation, credit alerts) continue via SendPulse and are exempt from suppression.
- No changes to existing email templates, `handle-unsubscribe`, or `email_unsubscribed` profile flag (those govern SendPulse opt-out and remain authoritative for transactional preferences).

## Deliverables

1. Migration creating the three tables + RLS.
2. Edge functions: `sync-contact-to-sendfox`, `sendfox-webhook`, `resync-all-sendfox`, `get-sendfox-config` (deployed automatically).
3. `supabase/config.toml` entry to disable JWT verification on `sendfox-webhook` only.
4. App-level sync hooks in signup + payment success paths.
5. `/admin/email-sync` admin page wired into the admin sidebar/router.
6. Secrets request for the three SendFox values.
7. `docs/email/README.md` with dashboard setup + testing checklist.
