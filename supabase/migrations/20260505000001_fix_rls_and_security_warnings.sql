-- ─────────────────────────────────────────────────────────────────────────────
-- Security hardening: fix all Supabase Security Advisor issues (2026-05-05)
--
-- ERRORS fixed (3):
--   1. RLS disabled on public.system_flags
--   2. RLS disabled on public.pricing_config
--   3. RLS disabled on public.audio_digests
--
-- WARNINGS fixed (3 of 5):
--   4. Function search_path mutable — public.set_updated_at
--   5. Public can execute SECURITY DEFINER — public.handle_new_user()
--   6. Signed-in users can execute SECURITY DEFINER — public.handle_new_user()
--
-- WARNINGS not fixable here (2 of 5):
--   • Extension in Public (pg_trgm) — moving extensions between schemas is
--     destructive and requires recreating dependent objects. Low risk: pg_trgm
--     has no known privilege-escalation vector. Accepted for now.
--   • Leaked Password Protection Disabled — Auth-level setting; must be enabled
--     in Supabase Dashboard → Authentication → Settings → Password Protection.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. system_flags — enable RLS, service role access only ───────────────────
--
-- This table is read exclusively by server-side code via the service role client
-- (createServiceClient). Service role bypasses RLS, so no user-facing policies
-- are needed. Enabling RLS blocks any accidental anon/authenticated access.

ALTER TABLE public.system_flags ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies — intentional.
-- Only the service role (Inngest functions, admin routes) should touch this table.


-- ── 2. pricing_config — enable RLS, allow public read ────────────────────────
--
-- pricing_config is read by getPricingConfig() via service client, so RLS alone
-- is enough to block unexpected access. We also add a public SELECT policy so
-- the data can be safely read by authenticated users or anon if ever needed
-- (e.g. client-side pricing components). Writes remain service-role-only.

ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pricing_config_public_read"
  ON public.pricing_config
  FOR SELECT
  USING (true);   -- read-only; no INSERT/UPDATE/DELETE policies for users


-- ── 3. audio_digests — enable RLS, users may only see their own rows ─────────
--
-- Inngest functions write via service role (bypasses RLS).
-- App API routes that serve audio may use the user client — restrict them to
-- the owner's rows only.

ALTER TABLE public.audio_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audio_digests_owner_select"
  ON public.audio_digests
  FOR SELECT
  USING (user_id = auth.uid());

-- Service role handles all writes; no user INSERT/UPDATE/DELETE policies.


-- ── 4. Fix set_updated_at — set explicit search_path ─────────────────────────
--
-- Without SET search_path, a superuser could manipulate the search_path to
-- redirect function calls. Adding SET search_path = '' forces fully-qualified
-- names and eliminates the mutable search-path attack surface.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ── 5 & 6. Revoke EXECUTE on handle_new_user from public roles ───────────────
--
-- handle_new_user is SECURITY DEFINER — it runs with elevated privileges.
-- Only the Postgres superuser (trigger infrastructure) should be able to
-- invoke it. Revoking from PUBLIC covers both anon and authenticated roles.
-- The trigger on auth.users calls it as the postgres role, so this revoke
-- does NOT break signup.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- Explicit revoke from authenticated in case it was granted separately
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
