
User declined the previous plan. Let me re-present it more concisely so they can approve.

## Add ETA Timer to Service Offline Status

**Admin side** (`AdminServiceStatusToggle.tsx`):
- Add a datetime picker: "Estimated back online at (optional)"
- Stored in `settings` table as new key `service_back_online_at`
- "Clear" button to remove the ETA

**Customer side** (`ServiceStatusBanner.tsx`):
- When offline AND ETA is in the future, show a live countdown below the offline message:
  - "⏱ Back online in 2h 15m" (updates every minute)
  - Plus absolute local time: "(approx. 9:00 AM today)"
- If ETA is empty or past → no countdown shown
- Realtime updates when admin changes the ETA

**Files to edit**
- `src/components/AdminServiceStatusToggle.tsx`
- `src/components/ServiceStatusBanner.tsx`

No DB migration needed — new key auto-created in existing `settings` table on first save.
