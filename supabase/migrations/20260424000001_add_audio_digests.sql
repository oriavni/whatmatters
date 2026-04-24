-- Audio Briefs: store generated audio for each digest
CREATE TABLE IF NOT EXISTS public.audio_digests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  digest_id       UUID NOT NULL REFERENCES public.digests(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  storage_path    TEXT,
  duration_sec    INTEGER,
  file_size_bytes INTEGER,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, digest_id)
);

CREATE INDEX IF NOT EXISTS audio_digests_user_id_idx ON public.audio_digests (user_id);
CREATE INDEX IF NOT EXISTS audio_digests_digest_id_idx ON public.audio_digests (digest_id);
CREATE INDEX IF NOT EXISTS audio_digests_status_idx ON public.audio_digests (status);

-- Add is_premium_override to users so admin can manually gate access before Stripe is wired
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_premium_override BOOLEAN NOT NULL DEFAULT FALSE;
