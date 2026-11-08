-- YouStats Stage 2 schema. Run in Supabase → SQL Editor (or `supabase db push`).

-- Google OAuth refresh tokens. Server-only: RLS on, no policies, so only the
-- secret key (server) can read or write.
create table if not exists public.google_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.google_tokens enable row level security;

-- Public video metadata cache (no personal data). Server-only.
create table if not exists public.video_meta (
  video_id text primary key,
  title text,
  channel_id text,
  duration_sec integer,
  live_start timestamptz,
  live_end timestamptz,
  was_live boolean not null default false,
  missing boolean not null default false,
  fetched_at timestamptz not null default now()
);
alter table public.video_meta enable row level security;

-- Channel memberships, entered by hand (the API does not expose them to viewers).
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  channel_name text not null check (char_length(channel_name) between 1 and 200),
  channel_url text,
  tier text,
  started_on date not null,
  ended_on date,
  created_at timestamptz not null default now(),
  check (ended_on is null or ended_on >= started_on)
);
alter table public.memberships enable row level security;

create policy "Own memberships: read" on public.memberships
  for select using (auth.uid() = user_id);
create policy "Own memberships: insert" on public.memberships
  for insert with check (auth.uid() = user_id);
create policy "Own memberships: update" on public.memberships
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own memberships: delete" on public.memberships
  for delete using (auth.uid() = user_id);
