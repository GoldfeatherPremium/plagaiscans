-- Phase 1.3: Tag push subscriptions with platform metadata
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();

-- Index for filtering by platform in admin diagnostics
CREATE INDEX IF NOT EXISTS push_subscriptions_platform_idx
  ON public.push_subscriptions(platform);