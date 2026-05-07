-- ── Repair broken signups ───────────────────────────────────────────────────
--
-- Users who signed up between 2026-04-24 and 2026-04-27 may be missing their
-- public.users, user_preferences, and/or subscriptions rows.
--
-- Root cause: is_premium_override was added to public.users without a DEFAULT,
-- causing the handle_new_user trigger to fail silently. Fixed in
-- 20260427000001_fix_signup_trigger.sql, but existing broken accounts were
-- not backfilled.
--
-- Effect of missing rows:
--   - checkTrialAllowed() returned trial_expired immediately (epoch fallback)
--   - digest-schedule skipped them as non-premium with accountAge > trialWindow
--
-- This migration repairs all auth.users that lack a public.users row by
-- inserting the missing profile, preferences, and subscription rows.
-- Repaired accounts get a fresh 7-day trial from NOW() so they can use the product.

-- 1. Insert missing public.users rows
INSERT INTO public.users (id, email, full_name, avatar_url, inbound_slug, is_premium_override)
SELECT
  au.id,
  au.email,
  au.raw_user_meta_data->>'full_name',
  au.raw_user_meta_data->>'avatar_url',
  substring(replace(au.id::text, '-', ''), 1, 16),
  false
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 2. Insert missing user_preferences rows
INSERT INTO public.user_preferences (user_id)
SELECT au.id
FROM auth.users au
LEFT JOIN public.user_preferences up ON up.user_id = au.id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 3. Insert missing subscriptions rows (fresh 7-day trial from now)
INSERT INTO public.subscriptions (user_id, plan, status, trial_end)
SELECT au.id, 'free', 'trialing', NOW() + INTERVAL '7 days'
FROM auth.users au
LEFT JOIN public.subscriptions sub ON sub.user_id = au.id
WHERE sub.user_id IS NULL
ON CONFLICT DO NOTHING;

-- 4. For subscriptions that exist but have status='active' with trial_end
--    already in the past (backfill from 20260425000003 set trial_end = created_at + 7 days
--    for all existing rows, meaning any account older than 7 days had an expired trial_end
--    immediately after the migration ran): ensure they stay status='active' — no change needed.
--    The fix in checkTrialAllowed and digest-schedule is: status='active' → always allowed.
--    So no change is needed here for existing active subscribers.
