-- Migration: add Pro/Premium plan columns to pricing_config
-- These columns are used by the admin PricingForm and the marketing pricing page
-- to optionally display a second "Pro" tier alongside the base plan.

ALTER TABLE public.pricing_config
  ADD COLUMN IF NOT EXISTS pro_visible         boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pro_price_monthly   numeric(6,2) NOT NULL DEFAULT 12.00,
  ADD COLUMN IF NOT EXISTS pro_label           text         NOT NULL DEFAULT 'Pro',
  ADD COLUMN IF NOT EXISTS pro_audio_limit     integer      NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS pro_description     text         NOT NULL DEFAULT 'Audio Briefs included — listen to every digest';
