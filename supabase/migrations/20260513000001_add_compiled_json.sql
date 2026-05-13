-- Add compiled_json column to digests table.
-- Stores the fully assembled Brief payload (clusters + sources) so SSR can
-- return a complete digest from a single DB read instead of 4 chained queries.
--
-- Only populated for newly generated digests (post-migration).
-- Old digests without compiled_json fall back to the existing multi-query path.

alter table public.digests
  add column if not exists compiled_json jsonb default null;

comment on column public.digests.compiled_json is
  'Pre-assembled BriefDigest payload (clusters, sources, isFullBlock).
   Excludes user-specific state (interactions, freshness).
   Populated at digest generation time. NULL = use legacy multi-query fallback.';
