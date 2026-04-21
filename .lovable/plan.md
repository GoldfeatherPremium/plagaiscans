

## Replace Signup Welcome Notification with Professional Copy

The current welcome notification dropped into every new customer's notification inbox at signup mentions "non-repository instructor accounts" — third-party-trademark-adjacent and informal. Replace it with neutral, professional copy aligned with PlagaiScans branding.

### Changes

**1. Database trigger (`send_welcome_notification`)**

Update the function via a new migration so it inserts the new title + message for all future signups.

- **Title:** `Welcome to PlagaiScans`
- **Message:** `Thank you for joining PlagaiScans. Your account is ready — upload a document anytime to receive a detailed Similarity Review and Content Analysis report. Need help getting started? Our support team is available 24/7.`

**2. Welcome email** (`supabase/functions/send-welcome-email/index.ts`)

Replace the matching green-banner line with the same professional sentence so the email stays consistent with the in-app notification.

### What stays the same

- Trigger timing, recipient, and delivery channel are unchanged.
- Existing notifications already in users' inboxes are not touched (only new signups get the new copy).
- No frontend changes required — the notification UI reads directly from `user_notifications`.

### Files touched

```
supabase/migrations/<new>.sql              update send_welcome_notification function
supabase/functions/send-welcome-email/index.ts   replace green-banner sentence
```

