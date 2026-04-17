
User wants the "Online" status to be compact — just a small green pill/badge in the top corner of the dashboard header, instead of a full-width banner. The "Offline" state should presumably still show the full banner (since it has important info like the message + countdown).

Looking at `DashboardHeader.tsx`, there's a top header with controls on the right side (credits, language, theme, notifications). I'll add a small status indicator there.

Plan:

## Compact Online Status Indicator

**When ONLINE:**
- Replace the full green banner with a small pill in the top dashboard header
- Green dot + "Online" label, placed near the other header controls (left of the language switcher)
- Subtle pulse animation on the dot for "live" feel
- Tooltip on hover: "System is online — uploads will be processed promptly"

**When OFFLINE:**
- Keep the existing full amber banner on Dashboard / UploadDocument / UploadSimilarity (it carries the offline message + countdown which need space)
- Also show a small amber "Offline" pill in the header so it's always visible even when scrolling

**Implementation**
- New component `ServiceStatusPill.tsx` — compact header indicator with Realtime subscription
- Add it to `DashboardHeader.tsx` in the right-side controls cluster
- Update `ServiceStatusBanner.tsx` to render `null` when status is `online` (banner only shows when offline)

**Files to edit**
- New: `src/components/ServiceStatusPill.tsx`
- Edit: `src/components/DashboardHeader.tsx` — mount the pill
- Edit: `src/components/ServiceStatusBanner.tsx` — return null when online
