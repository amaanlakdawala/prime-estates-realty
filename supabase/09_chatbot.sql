-- AI chatbot on firms' websites (app/api/chat, components/ChatWidget.js).
-- Run once in Supabase → SQL Editor, BEFORE deploying the code that uses it. Safe to run again.
--  - firms.ai_chat_enabled: the platform admin switches the chatbot on per firm (Firms → firm settings).
--  - chat_turns: one row per visitor message, for the rate limits and to see what the chatbot costs.
--    Only the server (service role) reads or writes it: row-level security is on with no policies.

alter table public.firms add column if not exists ai_chat_enabled boolean not null default false;

create table if not exists public.chat_turns (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  firm_id        uuid not null references public.firms(id) on delete cascade,
  ip_hash        text,          -- one-way hash of the visitor's IP, for rate limits only
  input_tokens   integer not null default 0,
  output_tokens  integer not null default 0,
  enquiry_saved  boolean not null default false
);

create index if not exists chat_turns_firm_idx on public.chat_turns (firm_id, created_at desc);
create index if not exists chat_turns_ip_idx on public.chat_turns (ip_hash, created_at desc);

alter table public.chat_turns enable row level security;
