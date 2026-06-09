-- Add the unique constraint on user_id that the upsert onConflict relies on.
-- Without this, `upsert(..., { onConflict: "user_id" })` throws a PostgREST
-- error (silently caught in the webhook handler) and never updates the row.
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
