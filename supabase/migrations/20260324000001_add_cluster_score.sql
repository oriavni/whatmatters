-- Add score column to topic_clusters so the digest-send step can
-- make importance-based tier decisions rather than pure rank-position cutoffs.
alter table public.topic_clusters
  add column if not exists score real not null default 0;
