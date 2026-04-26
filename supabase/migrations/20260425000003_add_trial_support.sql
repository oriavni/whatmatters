-- ── Trial support ──────────────────────────────────────────────────────────────
--
-- Adds trial_end to subscriptions and wires new users into a 7-day trial
-- rather than an immediately 'active' subscription.
--
-- Existing users keep status='active' (they are unaffected).
-- New users get status='trialing' + trial_end = NOW() + 7 days.
-- After trial_end, isUserPremium() returns false (until Stripe activates them).

-- 1. Add trial_end column
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_end timestamptz;

-- 2. Backfill trial_end for all existing rows so the column is non-null
--    (set to created_at + 7 days; for active users this is already in the past,
--    so it has no effect on isUserPremium — they remain active regardless).
UPDATE public.subscriptions
SET trial_end = created_at + INTERVAL '7 days'
WHERE trial_end IS NULL;

-- 3. Replace handle_new_user so future signups get a trialing subscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  slug text;
BEGIN
  slug := substring(replace(NEW.id::text, '-', ''), 1, 16);

  INSERT INTO public.users (id, email, full_name, avatar_url, inbound_slug)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    slug
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  -- New users start with a 7-day trial (trialing → expired → must pay)
  INSERT INTO public.subscriptions (user_id, plan, status, trial_end)
  VALUES (NEW.id, 'free', 'trialing', NOW() + INTERVAL '7 days')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
