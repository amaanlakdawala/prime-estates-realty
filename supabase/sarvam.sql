-- =============================================================
-- Sarvam AI as a second calling service: a firm whose voice is 'sarvam' is called by Riya on Sarvam
-- (Kavya voice) instead of the ElevenLabs agents. Calls and results land in the same tables.
-- Run once in Supabase: SQL Editor -> New query -> Run. Safe to run again. Needs ai_calls.sql.
-- =============================================================

alter table public.firms drop constraint if exists firms_voice_agent_check;
alter table public.firms add constraint firms_voice_agent_check check (voice_agent in ('sia', 'simran', 'sarvam'));
