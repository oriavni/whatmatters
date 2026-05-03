-- Add account freeze flag to users table.
-- Frozen users are silently blocked from generating digests/audio and from
-- having their scheduled deliveries fire. Existing data is unaffected.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false;
