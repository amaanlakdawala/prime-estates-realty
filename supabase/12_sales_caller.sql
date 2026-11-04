-- Sales caller: AI calls from Riya to your leads (brokerages), pitching your services.
-- Run once in Supabase → SQL Editor, after supabase/03_leads.sql. Safe to run again.

create table if not exists public.sales_calls (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  lead_id          uuid not null references public.leads(id) on delete cascade,
  attempt_id       text unique,                 -- Sarvam's id for the call; the webhook finds the row by it
  to_number        text not null,               -- +91XXXXXXXXXX
  status           text not null default 'placing'
                   check (status in ('placing', 'done', 'no_answer', 'failed')),
  duration_secs    integer,
  result           jsonb,                       -- what Riya learned: interested, demo_time, whatsapp_ok, …
  transcript       jsonb,                       -- [{ role: 'agent'|'caller', text }]
  error            text
);
create index if not exists sales_calls_lead_idx on public.sales_calls (lead_id, created_at desc);
create index if not exists sales_calls_created_idx on public.sales_calls (created_at desc);

-- Platform admin only (the server writes with the service role).
alter table public.sales_calls enable row level security;
drop policy if exists "Platform admin reads sales calls" on public.sales_calls;
create policy "Platform admin reads sales calls" on public.sales_calls
  for select to authenticated using (public.is_platform_admin());

-- Automatic calling (Leads → AI sales calls → Automatic calling). One row; off until you switch it on.
create table if not exists public.sales_caller_settings (
  id          smallint primary key default 1 check (id = 1),
  enabled     boolean not null default false,
  statuses    text[] not null default '{contacted}',   -- which leads get called: contacted = WhatsApp sent, no reply yet
  per_day     integer not null default 20 check (per_day between 1 and 30),
  updated_at  timestamptz not null default now()
);
insert into public.sales_caller_settings (id) values (1) on conflict (id) do nothing;
alter table public.sales_caller_settings enable row level security;
drop policy if exists "Platform admin reads sales caller settings" on public.sales_caller_settings;
create policy "Platform admin reads sales caller settings" on public.sales_caller_settings
  for select to authenticated using (public.is_platform_admin());
