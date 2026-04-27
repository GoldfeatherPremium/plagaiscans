-- SendFox promotional email integration tables

create table if not exists public.sendfox_contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sendfox_contact_id text not null,
  email text not null,
  current_tags text[] not null default array[]::text[],
  last_synced_at timestamptz not null default now(),
  sync_status text not null default 'ok'
);
create index if not exists idx_sendfox_contacts_email on public.sendfox_contacts(lower(email));

create table if not exists public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  reason text not null default 'user_unsubscribe',
  source text not null default 'sendfox',
  created_at timestamptz not null default now()
);
create index if not exists idx_email_suppressions_email on public.email_suppressions(lower(email));

create table if not exists public.sendfox_sync_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  action text,
  status text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_sendfox_sync_log_created on public.sendfox_sync_log(created_at desc);

alter table public.sendfox_contacts enable row level security;
alter table public.email_suppressions enable row level security;
alter table public.sendfox_sync_log enable row level security;

create policy "Admins manage sendfox_contacts"
  on public.sendfox_contacts for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage email_suppressions"
  on public.email_suppressions for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins read sendfox_sync_log"
  on public.sendfox_sync_log for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));
