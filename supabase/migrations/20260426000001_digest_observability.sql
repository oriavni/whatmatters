-- ── Phase 2: Digest observability ────────────────────────────────────────────
--
-- Adds three columns to digests so the admin can see when generation started,
-- when it finished, and why it failed.
--
-- started_at  — set when the digest row is created (step 2 of digest-generate)
-- finished_at — set when the digest is marked sent OR failed
-- error_message — set only when status transitions to 'failed'

ALTER TABLE public.digests
  ADD COLUMN IF NOT EXISTS started_at    timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at   timestamptz,
  ADD COLUMN IF NOT EXISTS error_message text;

-- Backfill started_at ≈ created_at for existing rows (best approximation)
UPDATE public.digests
SET started_at = created_at
WHERE started_at IS NULL;

-- Backfill finished_at ≈ sent_at (or updated_at for failed rows) for existing rows
UPDATE public.digests
SET finished_at = COALESCE(sent_at, updated_at)
WHERE finished_at IS NULL
  AND status IN ('sent', 'failed', 'ready');
