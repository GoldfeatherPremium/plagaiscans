

## Role-Based Idle Auto-Logout — 60 / 45 / 30 minutes with 5-minute warning

Implements automatic sign-out after a period of user inactivity, with a warning modal that appears 5 minutes before logout so the user can choose to stay signed in.

### Idle thresholds by role

| Role | Idle limit | Warning shown at |
|---|---|---|
| Customer | 60 min | 55 min |
| Staff | 45 min | 40 min |
| Admin | 30 min | 25 min |
| Guest / logged-out | n/a | n/a |

### Behavior

- Activity that resets the timer: `mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll`, `click` (throttled to 1/sec to avoid CPU churn).
- At the warning threshold a centered AlertDialog appears: **"You'll be signed out in 5:00"** with a live MM:SS countdown, a **Stay signed in** button (resets the timer), and a **Sign out now** button.
- If the countdown reaches zero with no interaction, `signOut()` is called and the user is redirected to `/auth?reason=timeout` with a toast: *"Signed out due to inactivity."*
- **Pause conditions** (timer does not advance while these are true):
  - Active file upload in progress (detected via a lightweight `useUploadActivity` flag stored in a module-level ref/window).
  - User is on `/checkout` (payment in progress).
- **Cross-tab sync**: a `lastActivity` timestamp is written to `localStorage` on each activity event; tabs read it on `storage` events, so activity in any tab keeps all tabs alive and logout in one tab logs out the others.
- **PWA / mobile resume**: on `visibilitychange → visible` and on `focus`, the component recomputes `now - lastActivity` and either shows the warning or signs out immediately if the threshold has already been crossed while the tab was backgrounded.
- Timer stops entirely when the user is not authenticated.

### Files to create

```
src/hooks/useIdleTimer.ts
  - Pure timer hook. Inputs: { idleMs, warnMs, isPaused, onWarn, onExpire, onActivity }.
  - Tracks lastActivity (in-memory + localStorage 'plagai_last_activity').
  - Listens to activity events (throttled), 'storage', 'visibilitychange', 'focus'.
  - Returns { secondsUntilExpire, isWarning, reset, dismissWarning }.

src/contexts/UploadActivityContext.tsx
  - Tiny context exposing { setUploading(true|false) } and { isUploading }.
  - Wrapped at App root so any upload page can flag itself.

src/components/SessionTimeoutManager.tsx
  - Mounts inside <AuthProvider>. Reads role from useAuth.
  - Picks idle limit by role (60/45/30 min, default 60).
  - Uses useIdleTimer; when warning fires, opens an AlertDialog with countdown.
  - "Stay signed in" -> reset(). "Sign out now" / expiry -> signOut() + navigate('/auth?reason=timeout') + toast.
  - Pauses when isUploading or pathname starts with '/checkout'.
```

### Files to edit

```
src/App.tsx
  - Wrap children with <UploadActivityProvider>.
  - Mount <SessionTimeoutManager /> inside the authenticated layout area.

src/pages/UploadDocument.tsx
src/pages/UploadSimilarity.tsx
src/components/BulkUploadPanel.tsx
src/pages/GuestUpload.tsx (guest path is exempt anyway, but flag for consistency if logged-in)
  - Call setUploading(true) when an upload starts, setUploading(false) in finally.

src/pages/Auth.tsx
  - If URL has ?reason=timeout, show an inline notice "You were signed out due to inactivity."

src/i18n/locales/{en,ar,zh,fr,es,de,ru}/common.json
  - Add keys:
      session.timeoutTitle: "Still there?"
      session.timeoutBody: "You'll be signed out in {{time}} due to inactivity."
      session.stay: "Stay signed in"
      session.signOutNow: "Sign out now"
      session.signedOutToast: "Signed out due to inactivity."
      session.timeoutBanner: "You were signed out due to inactivity."
```

### Edge cases handled

- Multiple tabs open: shared `lastActivity` via `localStorage` keeps all in sync.
- Background tab past threshold: detected on resume, immediate logout.
- Network offline: logout still runs locally (`signOut` clears local session); next online sync clears server session.
- Role changes mid-session (rare, e.g. admin promotes user): `SessionTimeoutManager` re-derives limit from `useAuth().role` so the new threshold takes effect on next reset.
- Already signed out: manager renders nothing.

### Memory update

Update `mem://constraints/auth/session-timeout-auto-logout` with the new role-based thresholds (60 / 45 / 30) and 5-minute warning, replacing the old "30-minute" rule.

### Verification

- Sign in as customer → wait 55 min → modal appears with 5:00 countdown → click "Stay signed in" → modal closes, timer resets.
- Same as staff (modal at 40 min) and admin (modal at 25 min).
- Let countdown reach 0:00 → redirected to `/auth?reason=timeout` with toast and inline notice.
- Open two tabs, move mouse in tab A → tab B's timer also resets.
- Start a bulk upload → leave idle past threshold → timer stays paused; resumes on upload completion.
- Open `/checkout` → timer paused while present.

