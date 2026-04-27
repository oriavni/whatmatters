-- Fix signup: is_premium_override was added to public.users without a DEFAULT,
-- causing the handle_new_user trigger to fail on every new signup with
-- "Database error saving new user".
--
-- Root cause: the trigger's INSERT INTO users omits is_premium_override,
-- and without a column default the NOT NULL constraint fires.
--
-- Fix: add DEFAULT false to the column + update the trigger to be explicit.

-- 1. Add the missing column default
ALTER TABLE public.users
  ALTER COLUMN is_premium_override SET DEFAULT false;

-- 2. Replace handle_new_user — explicit about all NOT NULL columns,
--    keeps the 7-day trial logic from 20260425000003.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  slug text;
BEGIN
  slug := substring(replace(NEW.id::text, '-', ''), 1, 16);

  INSERT INTO public.users (id, email, full_name, avatar_url, inbound_slug, is_premium_override)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    slug,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plan, status, trial_end)
  VALUES (NEW.id, 'free', 'trialing', NOW() + INTERVAL '7 days')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
