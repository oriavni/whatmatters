-- Migration: topic suppressions for multi-state ignore
--
-- Adds:
--   1. feedback_events.metadata jsonb  — stores suppress_level on every ignore click (audit trail)
--   2. topic_suppressions table        — operational suppression state (decremented per digest)

-- 1. Add metadata column to feedback_events for richer audit trail
ALTER TABLE public.feedback_events
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- 2. Topic suppressions — one row per (user, topic), decremented by digest-generate
CREATE TABLE IF NOT EXISTS public.topic_suppressions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL,
  topic             text        NOT NULL,
  source_cluster_id uuid        REFERENCES public.topic_clusters(id) ON DELETE SET NULL,
  suppress_level    smallint    NOT NULL CHECK (suppress_level BETWEEN 1 AND 3),
  digests_remaining smallint    NOT NULL CHECK (digests_remaining >= 0),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic)
);

-- Row-level security: users can only see / modify their own suppressions
ALTER TABLE public.topic_suppressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own topic suppressions"
  ON public.topic_suppressions
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
