-- ─────────────────────────────────────────────────────────────────────────────
-- Coupon / free-tester system
--
-- Creem's native discounts API exists but our API key currently lacks the
-- required scopes, and Creem discounts can't directly grant "free full access"
-- to a specific plan tier outside the checkout/billing flow. This gives us a
-- lightweight, fully-controlled coupon system for:
--   - Discount codes (percent off, redeemed at signup/upgrade)
--   - Free-access codes (grants a plan directly, no payment at all)
--
-- Redemption is enforced server-side (max_redemptions, expiry, active flag,
-- one-redemption-per-user) via the /api/coupons/redeem endpoint.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coupon_codes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text UNIQUE NOT NULL,
  plan_granted        public.subscription_plan NOT NULL,   -- 'pro' | 'premium'
  access_type         text NOT NULL CHECK (access_type IN ('discount', 'free')),
  discount_percent    integer CHECK (discount_percent IS NULL OR (discount_percent > 0 AND discount_percent <= 100)),
  max_redemptions     integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redemptions_count   integer NOT NULL DEFAULT 0,
  expires_at          timestamptz,
  is_active           boolean NOT NULL DEFAULT true,
  note                text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES public.users(id),

  -- 'free' codes grant access directly and shouldn't carry a discount percent
  CONSTRAINT coupon_access_type_shape CHECK (
    (access_type = 'free'     AND discount_percent IS NULL) OR
    (access_type = 'discount' AND discount_percent IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id     uuid NOT NULL REFERENCES public.coupon_codes(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  redeemed_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (coupon_id, user_id)  -- one redemption per user per coupon
);

CREATE INDEX IF NOT EXISTS coupon_codes_code_idx
  ON public.coupon_codes (code);

CREATE INDEX IF NOT EXISTS coupon_codes_active_idx
  ON public.coupon_codes (is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS coupon_redemptions_user_idx
  ON public.coupon_redemptions (user_id);

CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_idx
  ON public.coupon_redemptions (coupon_id);

-- RLS: service-role only (admin + redemption endpoint use createServiceClient).
-- No end-user direct table access — everything goes through API routes that
-- enforce admin auth or redemption rules.
ALTER TABLE public.coupon_codes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions  ENABLE ROW LEVEL SECURITY;

-- (No policies added — service role bypasses RLS; this blocks anon/authenticated
-- direct table access entirely, which is the desired posture for admin-managed data.)
