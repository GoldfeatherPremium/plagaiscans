# Email Architecture: Dual Pipeline

PlagaiScans uses two **completely isolated** email pipelines:

| Pipeline | Provider | Purpose | Suppression respected? |
|----------|----------|---------|------------------------|
| Transactional | SendPulse (existing) | Receipts, password resets, completion alerts, order confirmations, credit-balance alerts, support replies | **No** — these are service emails required by law and always send |
| Promotional | SendFox (this integration) | Marketing campaigns, re-engagement, "buy more credits" nudges, news | **Yes** — checked against `email_suppressions` table |

The two pipelines never share code, secrets, or templates. Disabling one cannot affect the other.

## Promotional pipeline (SendFox)

### Components

- **`sendfox_contacts`** — maps each user to their SendFox contact id and the tag set last applied.
- **`email_suppressions`** — promotional opt-out list (synced from SendFox webhooks; transactional sends ignore this table).
- **`sendfox_sync_log`** — append-only audit log of every sync attempt and webhook event.

### Edge functions

- **`sync-contact-to-sendfox`** — Idempotent. Takes `{ user_id }`, computes tags, creates or updates the SendFox contact, upserts the local mapping, logs the result. Skips users whose email is in `email_suppressions`.
- **`sendfox-webhook`** — Public endpoint (deployed with `verify_jwt = false`, validated via `SENDFOX_WEBHOOK_SECRET`). Receives unsubscribe/bounce/complaint events from SendFox and writes them to `email_suppressions`.
- **`resync-all-sendfox`** — Admin-only. Paginates `profiles` and invokes `sync-contact-to-sendfox` in batches of 10/sec to respect SendFox rate limits.
- **`get-sendfox-config`** — Admin-only. Returns the configured list id and a boolean indicating whether the access token / webhook secret are configured. Never returns the secrets themselves.

### Tags applied automatically

| Tag | Rule |
|-----|------|
| `customer` | Has at least one paid invoice |
| `lead` | Registered, no paid invoices yet |
| `low_credits` | `credit_balance + similarity_credit_balance < 5` |
| `high_value` | Lifetime spend ≥ $100 (sum of paid invoices) |
| `active` | Last sign-in within 7 days |
| `inactive_30d` | Last sign-in 30+ days ago, or never signed in |

### Auto-sync triggers

Sync is invoked from the application code, not via DB triggers (to keep the integration portable):

- **Signup** (`src/contexts/AuthContext.tsx → signUp`) — fires `triggerSendfoxSync(userId)` 1.5s after signup so the profile row trigger has time to create the row.
- **Future**: payment webhooks and credit-deduction handlers can also call `triggerSendfoxSync` from `src/lib/sendfoxSync.ts`. Failures are swallowed and logged — they must never block the user flow.

### Admin UI

Available at `/dashboard/email-sync` (and aliased at `/admin/email-sync`). Admin-only.

Shows: synced contact count, 24h error count, suppression list size, configured list id; tag breakdown; suppression list manager (add/remove); last 50 sync log entries (auto-refreshes every 15s); "Force resync all users" button.

### Required secrets

| Secret | How to obtain |
|--------|---------------|
| `SENDFOX_ACCESS_TOKEN` | sendfox.com → Account → API Access → Generate token |
| `SENDFOX_LIST_ID` | sendfox.com → Lists → create "Plagaiscans Customers" → copy the numeric id from the URL |
| `SENDFOX_WEBHOOK_SECRET` | Generate a random 32-char string. Configure the same value in SendFox → Settings → Webhooks |

## SendFox dashboard setup (manual, one-time)

1. **Create the list** — Lists → New list → "Plagaiscans Customers". Copy the id from the URL into `SENDFOX_LIST_ID`.
2. **Generate API token** — Account → API Access → Generate. Save as `SENDFOX_ACCESS_TOKEN`.
3. **Webhook** — Settings → Webhooks → Add webhook:
   - URL: `https://fyssbzgmhnolazjfwafm.supabase.co/functions/v1/sendfox-webhook?secret=<SENDFOX_WEBHOOK_SECRET>`
   - Events: `contact.unsubscribed`, `contact.bounced`, `contact.complained`
4. **Sender domain** — Settings → Sender Identity → add `plagaiscans.com`. SendFox will provide DNS records (SPF, DKIM).
   - **CRITICAL**: do NOT remove or modify SendPulse's existing DNS records.
   - For SPF: merge with the existing record (one SPF record per domain) — do not create two.
   - DKIM: SendFox uses a different selector from SendPulse, so both can coexist as separate TXT records.
5. **From-address** — Use `hello@plagaiscans.com` or `news@plagaiscans.com`. **Never** use any subdomain or username containing third-party trademarks (e.g. "turnitin").
6. **Sender footer** — Verify the registered office address is set:
   *Plagaiscans Technologies Ltd, Office 7513CI, 182-184 High Street North, London E6 2JA, UK*
7. **Optional richer segmentation** — Create separate lists per tag ("Low Credits", "High Value", "Inactive 30d"). The sync function can be extended to add/remove contacts from those lists; currently tags are stored locally only.

## Sending a campaign

1. Compose a campaign in the SendFox dashboard.
2. Select recipients = list "Plagaiscans Customers".
3. (Optional) filter by tag if richer segmentation was configured.
4. SendFox handles delivery, click/open tracking, unsubscribes.
5. Unsubscribes flow back via webhook → `email_suppressions` → future syncs skip the user.

## Compliance notes

- UK PECR / GDPR / CAN-SPAM: SendFox automatically appends physical address + unsubscribe link.
- Only sync users with a legitimate-interest basis (existing customers re: similar services) or who explicitly opted in.
- Unsubscribes are honoured within 24h automatically by the webhook.
- The transactional pipeline is exempt — receipts, password resets, etc. always send via SendPulse regardless of suppression status, as required by law.

## Testing checklist

1. Create a test user → confirm contact appears in SendFox within ~30s with correct tags.
2. Reduce test user's credit balance to <5 → click "Force resync all users" → confirm `low_credits` tag is added.
3. Send a test campaign from SendFox dashboard → confirm delivery from the verified domain.
4. Click unsubscribe in the test email → confirm:
   - SendFox marks contact unsubscribed
   - Webhook fires (visible in `sendfox_sync_log`)
   - Email appears in `email_suppressions`
5. Place a test order with the unsubscribed user → confirm SendPulse transactional confirmation **still arrives** (suppression must not affect transactional).
6. Check SPF/DKIM/DMARC pass in received email headers for both pipelines.

## Isolation guarantees (do not break)

- No file containing `sendpulse` (case-insensitive) is touched by this integration.
- No `SENDPULSE_*` environment variable is read or modified.
- All promotional code lives in:
  - `supabase/functions/sync-contact-to-sendfox/`
  - `supabase/functions/sendfox-webhook/`
  - `supabase/functions/resync-all-sendfox/`
  - `supabase/functions/get-sendfox-config/`
  - `src/lib/sendfoxSync.ts`
  - `src/pages/AdminEmailSync.tsx`
- The `email_suppressions` table is consulted ONLY by `sync-contact-to-sendfox` and any future promotional sender. Transactional functions never read it.
