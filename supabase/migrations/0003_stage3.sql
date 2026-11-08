-- YouStats Stage 3: channel tracker + archive search.

create extension if not exists pg_trgm;

-- Public channel info, shared cache (no personal data).
create table if not exists public.channels (
  channel_id text primary key,
  title text not null,
  handle text,
  thumbnail text,
  uploads_playlist_id text,
  published_at timestamptz,
  -- Archive sync state: null token + backfill_done = full archive indexed.
  backfill_page_token text,
  backfill_done boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

-- Which user tracks which channel.
create table if not exists public.tracked_channels (
  user_id uuid not null references auth.users (id) on delete cascade,
  channel_id text not null references public.channels (channel_id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);

-- One row per channel per day (UTC).
create table if not exists public.channel_snapshots (
  channel_id text not null references public.channels (channel_id) on delete cascade,
  taken_on date not null,
  subscribers bigint,
  hidden_subscribers boolean not null default false,
  views bigint,
  videos integer,
  primary key (channel_id, taken_on)
);

-- Every upload we have indexed, searchable by title and description.
create table if not exists public.channel_videos (
  video_id text primary key,
  channel_id text not null references public.channels (channel_id) on delete cascade,
  title text not null,
  description text not null default '',
  published_at timestamptz not null,
  duration_sec integer,
  was_live boolean not null default false,
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', left(coalesce(description, ''), 5000)), 'B')
  ) stored
);
create index if not exists channel_videos_channel_published
  on public.channel_videos (channel_id, published_at desc);
create index if not exists channel_videos_search on public.channel_videos using gin (search);
create index if not exists channel_videos_title_trgm
  on public.channel_videos using gin (title gin_trgm_ops);

-- All Stage 3 tables are read and written by the server (secret key) only.
alter table public.channels enable row level security;
alter table public.tracked_channels enable row level security;
alter table public.channel_snapshots enable row level security;
alter table public.channel_videos enable row level security;

grant select, insert, update, delete on public.channels to service_role;
grant select, insert, update, delete on public.tracked_channels to service_role;
grant select, insert, update, delete on public.channel_snapshots to service_role;
grant select, insert, update, delete on public.channel_videos to service_role;
