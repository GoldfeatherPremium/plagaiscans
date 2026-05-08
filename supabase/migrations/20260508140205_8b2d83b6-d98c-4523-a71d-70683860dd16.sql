
ALTER TABLE public.external_api_accounts
  ADD COLUMN IF NOT EXISTS credits_remaining integer,
  ADD COLUMN IF NOT EXISTS credits_total integer,
  ADD COLUMN IF NOT EXISTS concurrency_limit integer,
  ADD COLUMN IF NOT EXISTS current_concurrent integer,
  ADD COLUMN IF NOT EXISTS daily_limit integer,
  ADD COLUMN IF NOT EXISTS daily_usage integer,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active_remote boolean,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_probe_error text,
  ADD COLUMN IF NOT EXISTS account_name text,
  ADD COLUMN IF NOT EXISTS client_id text;
