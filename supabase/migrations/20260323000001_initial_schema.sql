-- ─────────────────────────────────────────────────────────────────────────────
-- WhatMatters — Initial Schema
-- Target: whatmatters-dev (evwnsjasckgboqtyramp)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extensions ────────────────────────────────────────────────────────────────
-- gen_random_uuid() is built into Postgres 13+ (pgcrypto not required)
create extension if not exists "pg_trgm";   -- for future full-text / fuzzy search

-- ── Enums ─────────────────────────────────────────────────────────────────────
create type source_type as enum ('rss', 'newsletter', 'manual');
create type source_status as enum ('active', 'paused', 'error');
create type digest_status as enum ('pending', 'generating', 'ready', 'sent', 'failed');
create type feedback_type as enum ('thumbs_up', 'thumbs_down', 'skip', 'save');
create type reply_action_type as enum ('expand', 'save', 'skip', 'share', 'unsubscribe');
create type job_status as enum ('queued', 'running', 'done', 'failed');
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'paused');
create type subscription_plan as enum ('free', 'pro');

-- ── users ─────────────────────────────────────────────────────────────────────
-- Mirrors auth.users; extended profile + inbound email slug
create table public.users (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text not null,
  full_name         text,
  avatar_url        text,
  -- The local part of the inbound email address (domain comes from env config)
  -- e.g. "a1b2c3d4e5f6g7h8" → a1b2c3d4e5f6g7h8@inbound.yourdomain.com
  inbound_slug      text unique not null,
  timezone          text not null default 'UTC',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users: select own row"
  on public.users for select
  using (auth.uid() = id);

create policy "users: update own row"
  on public.users for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── subscriptions ─────────────────────────────────────────────────────────────
create table public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.users(id) on delete cascade,
  stripe_customer_id    text unique,
  stripe_subscription_id text unique,
  plan                  subscription_plan not null default 'free',
  status                subscription_status not null default 'active',
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  cancel_at_period_end  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "subscriptions: select own"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- ── sources ───────────────────────────────────────────────────────────────────
create table public.sources (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  type          source_type not null,
  name          text not null,
  url           text,                         -- RSS feed URL or newsletter sender address
  status        source_status not null default 'active',
  last_fetched_at timestamptz,
  error_message text,
  metadata      jsonb not null default '{}',  -- arbitrary per-type extra data
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.sources enable row level security;

create policy "sources: all own"
  on public.sources for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index sources_user_id_idx on public.sources(user_id);

-- ── raw_items ─────────────────────────────────────────────────────────────────
-- One row per ingested email / RSS entry (before clustering/digest)
create table public.raw_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  source_id       uuid references public.sources(id) on delete set null,
  source_type     source_type not null,
  subject         text,
  sender_name     text,
  sender_email    text,
  received_at     timestamptz not null default now(),
  -- Full HTML stored in Supabase Storage (bucket: raw-emails) — path only
  raw_html_path   text,
  -- Extracted plain text for LLM processing
  body_text       text,
  summary         text,                       -- LLM-generated one-liner
  is_processed    boolean not null default false,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now()
);

alter table public.raw_items enable row level security;

create policy "raw_items: all own"
  on public.raw_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index raw_items_user_id_idx on public.raw_items(user_id);
create index raw_items_source_id_idx on public.raw_items(source_id);
create index raw_items_received_at_idx on public.raw_items(received_at desc);
create index raw_items_is_processed_idx on public.raw_items(is_processed) where not is_processed;

-- ── user_preferences ──────────────────────────────────────────────────────────
create table public.user_preferences (
  user_id           uuid primary key references public.users(id) on delete cascade,
  digest_frequency  text not null default 'daily',   -- 'daily' | 'weekly'
  digest_time       time not null default '07:00',   -- local time
  digest_day        smallint,                         -- 0=Sun..6=Sat for weekly
  topics            text[] not null default '{}',    -- user-curated topic labels
  email_format      text not null default 'html',    -- 'html' | 'plain'
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "user_preferences: all own"
  on public.user_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── topic_interests ───────────────────────────────────────────────────────────
-- Explicit interest weights per topic label, learned + user-editable
create table public.topic_interests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  topic       text not null,
  weight      real not null default 1.0,   -- 0.0 = muted, 1.0 = normal, 2.0+ = boosted
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(user_id, topic)
);

alter table public.topic_interests enable row level security;

create policy "topic_interests: all own"
  on public.topic_interests for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index topic_interests_user_id_idx on public.topic_interests(user_id);

-- ── digests ───────────────────────────────────────────────────────────────────
create table public.digests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  status          digest_status not null default 'pending',
  period_start    timestamptz not null,
  period_end      timestamptz not null,
  subject         text,
  html_body       text,
  plain_body      text,
  sent_at         timestamptz,
  opened_at       timestamptz,
  postmark_message_id text,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.digests enable row level security;

create policy "digests: select own"
  on public.digests for select
  using (auth.uid() = user_id);

create index digests_user_id_idx on public.digests(user_id);
create index digests_status_idx on public.digests(status) where status in ('pending', 'generating');

-- ── topic_clusters ────────────────────────────────────────────────────────────
-- LLM-generated clusters that belong to a digest
create table public.topic_clusters (
  id          uuid primary key default gen_random_uuid(),
  digest_id   uuid not null references public.digests(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  topic       text not null,
  summary     text,
  rank        smallint not null default 0,   -- display order within digest
  raw_item_ids uuid[] not null default '{}', -- source raw_items for this cluster
  created_at  timestamptz not null default now()
);

alter table public.topic_clusters enable row level security;

create policy "topic_clusters: select own"
  on public.topic_clusters for select
  using (auth.uid() = user_id);

create index topic_clusters_digest_id_idx on public.topic_clusters(digest_id);

-- ── feedback_events ───────────────────────────────────────────────────────────
create table public.feedback_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  digest_id   uuid references public.digests(id) on delete set null,
  cluster_id  uuid references public.topic_clusters(id) on delete set null,
  raw_item_id uuid references public.raw_items(id) on delete set null,
  type        feedback_type not null,
  created_at  timestamptz not null default now()
);

alter table public.feedback_events enable row level security;

create policy "feedback_events: all own"
  on public.feedback_events for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index feedback_events_user_id_idx on public.feedback_events(user_id);

-- ── reply_actions ─────────────────────────────────────────────────────────────
-- Actions parsed from user email replies to digests
create table public.reply_actions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  digest_id   uuid references public.digests(id) on delete set null,
  cluster_id  uuid references public.topic_clusters(id) on delete set null,
  raw_item_id uuid references public.raw_items(id) on delete set null,
  action      reply_action_type not null,
  raw_reply   text,
  parsed_at   timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

alter table public.reply_actions enable row level security;

create policy "reply_actions: all own"
  on public.reply_actions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index reply_actions_user_id_idx on public.reply_actions(user_id);

-- ── saved_items ───────────────────────────────────────────────────────────────
create table public.saved_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  raw_item_id uuid references public.raw_items(id) on delete set null,
  cluster_id  uuid references public.topic_clusters(id) on delete set null,
  note        text,
  created_at  timestamptz not null default now(),
  unique(user_id, raw_item_id),
  unique(user_id, cluster_id)
);

alter table public.saved_items enable row level security;

create policy "saved_items: all own"
  on public.saved_items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index saved_items_user_id_idx on public.saved_items(user_id);

-- ── job_logs ──────────────────────────────────────────────────────────────────
-- Audit log for background Inngest jobs
create table public.job_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete set null,
  job_name    text not null,
  status      job_status not null default 'queued',
  started_at  timestamptz,
  finished_at timestamptz,
  error       text,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

alter table public.job_logs enable row level security;

create policy "job_logs: select own"
  on public.job_logs for select
  using (auth.uid() = user_id);

-- Service role can insert/update job_logs (Inngest runs with service role)
create policy "job_logs: service role write"
  on public.job_logs for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create index job_logs_user_id_idx on public.job_logs(user_id);
create index job_logs_status_idx on public.job_logs(status);

-- ── Storage: raw-emails bucket ────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'raw-emails',
  'raw-emails',
  false,                -- private bucket
  10485760,             -- 10 MB per file
  array['text/html', 'text/plain', 'message/rfc822']
)
on conflict (id) do nothing;

-- Users can read their own raw email files (path format: {user_id}/*)
create policy "raw-emails: select own"
  on storage.objects for select
  using (
    bucket_id = 'raw-emails'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Service role can write (used by inbound email handler)
create policy "raw-emails: service role write"
  on storage.objects for insert
  with check (
    bucket_id = 'raw-emails'
    and auth.role() = 'service_role'
  );

create policy "raw-emails: service role delete"
  on storage.objects for delete
  using (
    bucket_id = 'raw-emails'
    and auth.role() = 'service_role'
  );

-- ── updated_at trigger ────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

create trigger sources_updated_at
  before update on public.sources
  for each row execute function public.set_updated_at();

create trigger user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();

create trigger topic_interests_updated_at
  before update on public.topic_interests
  for each row execute function public.set_updated_at();

create trigger digests_updated_at
  before update on public.digests
  for each row execute function public.set_updated_at();

-- ── handle_new_user trigger ───────────────────────────────────────────────────
-- Fires on every auth.users INSERT to create the public profile + preferences
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  slug text;
begin
  -- Generate a 16-char alphanumeric slug from the UUID (strip hyphens, take first 16)
  slug := substring(replace(NEW.id::text, '-', ''), 1, 16);

  insert into public.users (id, email, full_name, avatar_url, inbound_slug)
  values (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    slug
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (NEW.id)
  on conflict (user_id) do nothing;

  insert into public.subscriptions (user_id, plan, status)
  values (NEW.id, 'free', 'active')
  on conflict do nothing;

  return NEW;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
