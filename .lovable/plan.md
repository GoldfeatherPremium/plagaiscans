

## Plan

### 1. Remove the Dynamic Island refresh banner

The `RefreshProgressBar` component renders an iPhone Dynamic Island-style floating pill that shows pull-to-refresh and route-change loading status. It will be completely removed.

**Changes:**
- **`src/App.tsx`**: Remove the `RefreshProgressBar` import and its usage (`<RefreshProgressBar />`)
- **`src/components/RefreshProgressBar.tsx`**: Delete the file
- The pull-to-refresh hook (`usePullToRefresh`) remains available if needed elsewhere but is no longer invoked

### 2. Push notifications when app/site is closed — already working

After reviewing the code, **server-side push notifications for document completion are already implemented**:

- When a document is completed, `send-completion-email` (edge function) calls `send-push-notification` server-side (lines 300-322)
- The service worker (`sw.js`) handles incoming push events and displays native OS notifications even when the app is closed (lines 127-171)
- The `useDocumentCompletionNotifications` hook provides *additional* in-app toast/sound when the app is open — this is complementary, not the primary delivery mechanism

**For this to work, the customer must have:**
1. Granted notification permission in their browser
2. An active push subscription stored in the `push_subscriptions` table

**No code changes needed** for this part — the infrastructure is already in place. If customers report not receiving notifications when the app is closed, the issue would be subscription health (already monitored by `usePushSubscriptionHealth`) or browser-level notification permissions.

**For guests**: Guests don't have user accounts or push subscriptions, so web push is not applicable to them. They receive completion emails instead.

---

**Summary**: Only 2 files need changes — remove the import/usage from `App.tsx` and delete `RefreshProgressBar.tsx`.

