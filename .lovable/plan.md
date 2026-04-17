
The user wants an admin-controlled online/offline system status that:
- Admins can toggle online/offline with a button
- Customers see the current status in their dashboard
- When offline, customers know not to expect immediate processing
- Real-time updates when admin toggles status

I already see there's a `settings` table being used (for `maintenance_mode_enabled` and `maintenance_message`). I'll reuse this pattern for a new `service_status` setting. This is much lighter than maintenance mode (which blocks the whole site) — this just shows a status banner.

Let me design this concisely.

## System Service Status (Online/Offline Indicator)

### What it does
- Admins toggle a "Service Online/Offline" switch from the admin panel
- Customers see a clear status banner on their dashboard ("✅ Service Online — uploads will be processed promptly" / "🌙 Service Offline — uploads queued, will be processed when we're back")
- Status updates in real-time (no refresh needed) via Supabase Realtime
- Optional custom offline message (e.g. "We're offline until 9 AM GMT")

### Implementation

**1. Database (settings table)**
Add 3 new keys to existing `settings` table (no schema change needed — already key/value):
- `service_status` → `'online'` or `'offline'`
- `service_offline_message` → custom message shown when offline
- `service_status_updated_at` → timestamp of last change

Enable Realtime on `settings` table (if not already).

**2. Admin Toggle UI**
Add a new card on `AdminSettings.tsx` (or `AdminDashboardOverview.tsx` for quick access):
- Big switch: "Service Online" / "Service Offline"
- Textarea for custom offline message
- Shows "Last changed by [admin] at [time]"

**3. Customer Status Banner**
New component `ServiceStatusBanner.tsx` shown on customer dashboard pages:
- Green banner when online: "✅ Service Online — your uploads are being processed"
- Amber banner when offline: "🌙 Service Offline — [custom message]. Your uploads will be queued."
- Subscribes to Realtime updates so changes appear instantly

**4. Where banner appears**
- Customer Dashboard (`Dashboard.tsx`)
- Upload pages (`UploadDocument.tsx`, `UploadSimilarity.tsx`) — most relevant moment
- Optional: also on guest upload page

### Files to create/edit
- New: `src/components/ServiceStatusBanner.tsx` — customer-facing banner with Realtime subscription
- New: `src/components/AdminServiceStatusToggle.tsx` — admin toggle card
- Edit: `src/pages/AdminSettings.tsx` — add the toggle card
- Edit: `src/pages/Dashboard.tsx`, `src/pages/UploadDocument.tsx`, `src/pages/UploadSimilarity.tsx` — show banner
- Migration: insert 3 default settings rows + enable Realtime on `settings` table

### Notes
- Going "offline" does NOT block uploads — customers can still upload, it just sets expectations
- This is separate from the existing Maintenance Mode (which blocks the site entirely)
- Both admins and staff can see/toggle it; only admins control it (read-only display for staff in UI)

