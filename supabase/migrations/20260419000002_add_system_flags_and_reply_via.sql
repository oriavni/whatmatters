-- ── reply_actions: add via column ─────────────────────────────────────────────
-- Tracks whether the reply was processed via Inngest or the inline fallback.
ALTER TABLE public.reply_actions ADD COLUMN IF NOT EXISTS via text;

-- ── system_flags ───────────────────────────────────────────────────────────────
-- Key-value boolean toggles for operational control. Readable by service role only.
-- Only 'replies_disabled' is enforced in code today; others are UI-only placeholders.
CREATE TABLE IF NOT EXISTS public.system_flags (
  key         text PRIMARY KEY,
  value       boolean NOT NULL DEFAULT false,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.system_flags (key, value, description) VALUES
  ('replies_disabled',    false, 'Block all email reply command processing'),
  ('ingestion_disabled',  false, 'Block new inbound email ingestion (UI only — not wired)'),
  ('llm_disabled',        false, 'Disable LLM parsing (UI only — not wired)'),
  ('force_inline',        false, 'Force inline fallback, bypass Inngest (UI only — not wired)')
ON CONFLICT (key) DO NOTHING;
