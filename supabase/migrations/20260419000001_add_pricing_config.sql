-- ── pricing_config ────────────────────────────────────────────────────────────
-- Single-row table (id = 'default') for admin-controlled pricing settings.
-- No RLS — service role only (admin API routes use service client).

create table public.pricing_config (
  id                    text primary key default 'default',
  price_monthly         numeric(6,2) not null default 7.00,
  trial_days            integer not null default 7,
  deal_active           boolean not null default false,
  deal_label            text not null default 'Founding member — 30% off forever',
  deal_price_monthly    numeric(6,2) not null default 4.99,
  deal_slots_total      integer not null default 50,
  deal_slots_remaining  integer not null default 50,
  updated_at            timestamptz not null default now()
);

-- Seed the default row
insert into public.pricing_config (id) values ('default')
  on conflict (id) do nothing;
