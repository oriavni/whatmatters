-- ─────────────────────────────────────────────────────────────────────────────
-- Add Creem billing support
--
-- Changes:
--   1. Add 'premium' value to subscription_plan enum
--   2. Add creem_customer_id + creem_subscription_id columns to subscriptions
--   3. Index on creem_subscription_id for fast webhook lookups
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Extend the plan enum (Postgres: ADD VALUE cannot run inside a transaction,
--    but Supabase migrations run outside an implicit transaction for DDL).
ALTER TYPE public.subscription_plan ADD VALUE IF NOT EXISTS 'premium';

-- 2. Add Creem-specific identifier columns (idempotent)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS creem_customer_id     text,
  ADD COLUMN IF NOT EXISTS creem_subscription_id text;

-- 3. Index for O(1) webhook lookups
CREATE INDEX IF NOT EXISTS subscriptions_creem_sub_id_idx
  ON public.subscriptions (creem_subscription_id)
  WHERE creem_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS subscriptions_creem_cust_id_idx
  ON public.subscriptions (creem_customer_id)
  WHERE creem_customer_id IS NOT NULL;
