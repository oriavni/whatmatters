-- Cost tracking columns.
-- audio_digests.tts_chars: total characters submitted to OpenAI TTS.
-- digests.llm_tokens_input / llm_tokens_output: cumulative tokens across the
-- cluster + synthesize LLM calls for a single digest run.
ALTER TABLE public.audio_digests
  ADD COLUMN IF NOT EXISTS tts_chars integer;

ALTER TABLE public.digests
  ADD COLUMN IF NOT EXISTS llm_tokens_input integer,
  ADD COLUMN IF NOT EXISTS llm_tokens_output integer;
