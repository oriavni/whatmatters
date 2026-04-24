-- Add is_promotional flag to raw_items.
-- Promotional emails (ads, offers, discount emails) are stored but excluded
-- from digest generation. Detected at ingestion time.
ALTER TABLE public.raw_items
  ADD COLUMN IF NOT EXISTS is_promotional boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS raw_items_is_promotional_idx
  ON public.raw_items (is_promotional)
  WHERE is_promotional = true;
