

## Plan: Add Humanizer CTA to Dashboard + Admin Analytics Page

### 1. **`src/pages/Dashboard.tsx`** — Add humanizer promotion banner for customers

After the "Quick Actions" section (around line 497), add a promotional card visible only to customers:
- Purple/gradient card with Sparkles icon
- Title: "AI % is high? Don't worry!"
- Subtitle: "Use our free AI Humanizer tool to reduce AI detection in your content"
- "Try AI Humanizer" button linking to `/ai-humanizer`

### 2. **`supabase` migration** — Create `humanizer_usage_logs` table

Track every humanization request:
- `id` (uuid, PK)
- `user_id` (uuid, nullable — null for guests)
- `word_count` (integer)
- `mode` (text — standard/advanced/academic/creative)
- `increase_human_score` (boolean)
- `estimated_score` (integer)
- `created_at` (timestamptz)
- RLS: insert for anyone (anon + authenticated), select only for admins via `has_role`

### 3. **`supabase/functions/humanize-text/index.ts`** — Log usage

After successful humanization, insert a row into `humanizer_usage_logs` with the request details (user_id from JWT if available, word count, mode, score).

### 4. **`src/pages/AdminHumanizerAnalytics.tsx`** — New admin page

Comprehensive analytics dashboard showing:
- **Stats cards**: Total requests, unique users, guest vs. logged-in users, total words processed
- **Daily usage chart** (last 30 days bar chart)
- **Mode breakdown** (pie chart — Standard/Advanced/Academic/Creative)
- **Average human score** across all requests
- **Recent requests table**: timestamp, user (email or "Guest"), word count, mode, score

### 5. **`src/components/DashboardSidebar.tsx`** — Add admin link

Add `{ to: '/dashboard/humanizer-analytics', icon: Sparkles, label: 'Humanizer Analytics' }` to the Analytics group.

### 6. **`src/App.tsx`** — Add route

Add lazy-loaded route for `/dashboard/humanizer-analytics`.

### Files
1. `src/pages/Dashboard.tsx` — add customer CTA card
2. `supabase/functions/humanize-text/index.ts` — log usage to DB
3. `src/pages/AdminHumanizerAnalytics.tsx` — new admin analytics page
4. `src/components/DashboardSidebar.tsx` — add sidebar link
5. `src/App.tsx` — add route
6. DB migration — create `humanizer_usage_logs` table

