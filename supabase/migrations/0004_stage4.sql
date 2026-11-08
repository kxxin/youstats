-- YouStats Stage 4: live-stream alerts.

-- Per-user, per-channel alert choices (added to the Stage 3 tracking row).
alter table public.tracked_channels
  add column if not exists alert_live boolean not null default false,
  add column if not exists alert_scheduled boolean not null default false,
  add column if not exists alert_uploads boolean not null default false;

-- Where to send a user's alerts.
create table if not exists public.alert_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  discord_webhook_url text,
  updated_at timestamptz not null default now()
);

-- Browser push subscriptions (one per device/browser).
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

-- WebSub (PubSubHubbub) subscriptions to YouTube channel feeds.
create table if not exists public.websub_subscriptions (
  channel_id text primary key references public.channels (channel_id) on delete cascade,
  status text not null default 'pending', -- pending | active | unsubscribed
  lease_expires_at timestamptz,
  requested_at timestamptz,
  last_notification_at timestamptz
);

-- Every video we heard about, with what we already alerted for.
create table if not exists public.live_events (
  video_id text primary key,
  channel_id text not null references public.channels (channel_id) on delete cascade,
  title text not null,
  status text not null, -- upcoming | live | ended | video | gone
  scheduled_start timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  notified_scheduled_at timestamptz,
  notified_live_at timestamptz,
  notified_upload_at timestamptz,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists live_events_status_start on public.live_events (status, scheduled_start);
create index if not exists live_events_channel on public.live_events (channel_id, first_seen_at desc);

alter table public.alert_settings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.websub_subscriptions enable row level security;
alter table public.live_events enable row level security;

grant select, insert, update, delete on public.alert_settings to service_role;
grant select, insert, update, delete on public.push_subscriptions to service_role;
grant select, insert, update, delete on public.websub_subscriptions to service_role;
grant select, insert, update, delete on public.live_events to service_role;
