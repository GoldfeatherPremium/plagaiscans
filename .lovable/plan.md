

## Push Notification Reliability Fix

### Root Cause

The database has **massive subscription bloat** — one user alone has **25 stale push subscriptions**. When a notification is sent, it goes to all stored endpoints for a user. Most of these endpoints belong to old/expired browser sessions. The push service (FCM/WNS) silently accepts messages to stale endpoints (returns HTTP 201) but never actually delivers them. Since the system sees "success," it never cleans them up.

This is why ~60% of notifications never appear — the push is "sent successfully" server-side, but the endpoint is dead.

### Fix Plan

**1. Deduplicate subscriptions on subscribe**
In `usePushNotifications.ts`, when a user subscribes, delete ALL existing subscriptions for that user before inserting the new one. A user only has one active browser at a time that should receive pushes. This immediately prevents accumulation.

**2. Sync subscription on every page load**  
In `usePushSubscriptionHealth.ts`, on every visibility/load check, compare the current browser's push endpoint with what's stored in the DB. If the endpoint differs, update the DB record and remove stale entries. This ensures the DB always has the latest active endpoint.

**3. One-time database cleanup**  
Run a migration to remove duplicate subscriptions, keeping only the most recently created one per user. This will immediately fix the 25-subscription-per-user problem.

**4. Limit subscriptions per user server-side**  
In `send-push-notification/index.ts`, when fetching subscriptions, order by `created_at DESC` and limit to 2 per user (allowing for one desktop + one mobile). This prevents sending to dozens of stale endpoints even if cleanup fails.

### Technical Details

- **File