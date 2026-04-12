-- Add ignored_topics column to user_preferences
-- The existing `topics` column stores user interest labels (curated).
-- `ignored_topics` stores topic labels the user wants suppressed from future digests.
ALTER TABLE public.user_preferences
ADD COLUMN ignored_topics text[] NOT NULL DEFAULT '{}';
