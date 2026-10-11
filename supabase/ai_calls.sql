-- =============================================================
-- AI calling: contacts a firm wants the voice agent to call, and the calls made.
-- Run once in Supabase: SQL Editor -> New query -> Run. Safe to run again.
-- Needs multi_tenant.sql (firms, can_manage_firm, is_platform_admin).
-- =============================================================

-- Calls cost the platform owner money, so each firm is switched on individually, with a monthly cap.
alter table public.firms add column if not exists ai_calls_enabled boolean not null default false;
alter table public.firms add column if not exists ai_calls_monthly_limit integer not null default 100;
alter table public.firms add column if not exists voice_agent text not null default 'sia' check (voice_agent in ('sia', 'simran'));

create table if not exists public.call_contacts (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  firm_id            uuid not null references public.firms(id) on delete cascade,
  name               text not null default '',
  phone              text not null,                       -- E.164, e.g. +919820012345
  context            text not null default '',            -- why we're calling: "Enquired on 99acres"
  notes              text not null default '',            -- what we already know: "2 BHK Powai, 2 Cr"
  source             text not null default 'manual' check (source in ('manual', 'upload', 'website')),
  enquiry_id         uuid references public.enquiries(id) on delete set null,
  status             text not null default 'new'
                     check (status in ('new', 'calling', 'called', 'no_answer', 'failed', 'do_not_call')),
  call_count         integer not null default 0,
  last_called_at     timestamptz,
  consent_confirmed  boolean not null default false,      -- the firm confirmed this person asked to be contacted
  created_by         uuid default auth.uid() references auth.users(id) on delete set null,
  unique (firm_id, phone)
);
create index if not exists call_contacts_firm_idx on public.call_contacts (firm_id, status);

create table if not exists public.calls (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  firm_id          uuid not null references public.firms(id) on delete cascade,
  contact_id       uuid references public.call_contacts(id) on delete set null,
  conversation_id  text unique,                            -- ElevenLabs conversation
  call_sid         text,                                   -- Twilio call
  status           text not null default 'queued'
                   check (status in ('queued', 'in_progress', 'done', 'failed', 'no_answer')),
  duration_secs    integer,
  summary          text,
  result           jsonb,                                  -- what the agent learned: deal, area, bhk, budget…
  transcript       jsonb,
  error            text,
  started_by       uuid references auth.users(id) on delete set null
);
create index if not exists calls_firm_idx on public.calls (firm_id, created_at desc);

-- ---------- Row Level Security: a firm sees only its own contacts and calls ----------
alter table public.call_contacts enable row level security;
alter table public.calls         enable row level security;

drop policy if exists "Firm reads its contacts"   on public.call_contacts;
drop policy if exists "Firm adds its contacts"    on public.call_contacts;
drop policy if exists "Firm updates its contacts" on public.call_contacts;
drop policy if exists "Firm deletes its contacts" on public.call_contacts;
drop policy if exists "Firm reads its calls"      on public.calls;

create policy "Firm reads its contacts" on public.call_contacts
  for select to authenticated using (public.is_platform_admin() or firm_id = public.my_firm_id());
create policy "Firm adds its contacts" on public.call_contacts
  for insert to authenticated with check (public.can_manage_firm(firm_id));
create policy "Firm updates its contacts" on public.call_contacts
  for update to authenticated using (public.can_manage_firm(firm_id)) with check (public.can_manage_firm(firm_id));
create policy "Firm deletes its contacts" on public.call_contacts
  for delete to authenticated using (public.can_manage_firm(firm_id));

-- Calls are only ever written by the server (it places and tracks them); firms can read theirs.
create policy "Firm reads its calls" on public.calls
  for select to authenticated using (public.is_platform_admin() or firm_id = public.my_firm_id());
