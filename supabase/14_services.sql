-- =============================================================
-- Three add-on services, each switched on per firm by the platform admin (Firms -> firm):
--   1. Portal leads:    lead emails from 99acres, MagicBricks, Housing.com… become enquiries, and the automatic
--                       AI call follows within a minute (features/portal-leads).
--   2. Listing checks:  Riya calls each listing's owner every week to check it is still available, and closes or
--                       re-prices the listing from the answer (features/listing-checks).
--   3. WhatsApp AI:     Riya answers clients on the firm's WhatsApp Business number (features/whatsapp-assistant).
-- Run once in Supabase: SQL Editor -> New query -> Run. Safe to run again. Needs 01–09.
-- =============================================================

-- ---------- 1. Portal leads ----------
alter table public.firms add column if not exists portal_leads_enabled boolean not null default false;
-- The secret part of the firm's forwarding address (…+<key>@…). Set by the server when the service is switched on.
alter table public.firms add column if not exists portal_inbox_key text unique;

-- Every email that reached a firm's forwarding address, and what became of it.
create table if not exists public.portal_emails (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  sender      text not null default '',
  subject     text not null default '',
  body        text not null default '',     -- plain text, first 6,000 characters
  portal      text not null default '',     -- 99acres, MagicBricks, Housing.com… or '' when unknown
  status      text not null default 'received'
              check (status in ('received', 'lead', 'duplicate', 'not_a_lead', 'failed')),
  enquiry_id  uuid references public.enquiries(id) on delete set null,
  note        text not null default ''      -- what was understood, or why it was not a lead
);
create index if not exists portal_emails_firm_idx on public.portal_emails (firm_id, created_at desc);

alter table public.portal_emails enable row level security;
drop policy if exists "Firm reads its portal emails" on public.portal_emails;
create policy "Firm reads its portal emails" on public.portal_emails
  for select to authenticated using (public.is_platform_admin() or firm_id = public.my_firm_id());

-- ---------- 2. Listing checks ----------
alter table public.firms add column if not exists listing_checks_enabled boolean not null default false;
alter table public.firms add column if not exists listing_checks_monthly_limit integer not null default 200;
alter table public.firms add column if not exists listing_check_days integer not null default 7
  check (listing_check_days between 3 and 60);

-- Who owns each listing. Kept out of public.listings on purpose: anyone can read available listings.
create table if not exists public.listing_owners (
  listing_id   uuid primary key references public.listings(id) on delete cascade,
  firm_id      uuid not null references public.firms(id) on delete cascade,
  updated_at   timestamptz not null default now(),
  owner_name   text not null default '' check (char_length(owner_name) <= 120),
  owner_phone  text not null default '' check (char_length(owner_phone) <= 20),
  checks_paused boolean not null default false   -- the owner asked not to be called, or the firm paused it
);
create index if not exists listing_owners_firm_idx on public.listing_owners (firm_id);

alter table public.listing_owners enable row level security;
drop policy if exists "Firm reads its listing owners" on public.listing_owners;
drop policy if exists "Firm adds its listing owners" on public.listing_owners;
drop policy if exists "Firm updates its listing owners" on public.listing_owners;
drop policy if exists "Firm deletes its listing owners" on public.listing_owners;
create policy "Firm reads its listing owners" on public.listing_owners
  for select to authenticated using (public.is_platform_admin() or firm_id = public.my_firm_id());
create policy "Firm adds its listing owners" on public.listing_owners
  for insert to authenticated with check (public.can_manage_firm(firm_id) and public.listing_in_firm(listing_id, firm_id));
create policy "Firm updates its listing owners" on public.listing_owners
  for update to authenticated using (public.can_manage_firm(firm_id)) with check (public.can_manage_firm(firm_id) and public.listing_in_firm(listing_id, firm_id));
create policy "Firm deletes its listing owners" on public.listing_owners
  for delete to authenticated using (public.can_manage_firm(firm_id));

-- One row per check call. Written only by the server.
create table if not exists public.listing_checks (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  firm_id        uuid not null references public.firms(id) on delete cascade,
  listing_id     uuid references public.listings(id) on delete set null,
  to_number      text not null,
  attempt_id     text,                    -- Sarvam: 'cohort:<id>' while queued, then the attempt id
  status         text not null default 'placing' check (status in ('placing', 'done', 'no_answer', 'failed')),
  duration_secs  integer,
  result         jsonb,                   -- what the owner said: still_available, new_price, available_from…
  transcript     jsonb,
  outcome        text not null default '', -- what changed on the listing, in words
  error          text
);
create index if not exists listing_checks_firm_idx on public.listing_checks (firm_id, created_at desc);
create index if not exists listing_checks_listing_idx on public.listing_checks (listing_id, created_at desc);

alter table public.listing_checks enable row level security;
drop policy if exists "Firm reads its listing checks" on public.listing_checks;
create policy "Firm reads its listing checks" on public.listing_checks
  for select to authenticated using (public.is_platform_admin() or firm_id = public.my_firm_id());

-- ---------- 3. WhatsApp AI assistant ----------
alter table public.firms add column if not exists whatsapp_ai_enabled boolean not null default false;

-- The firm's WhatsApp Business number in Meta. The token never leaves the server (no policies: service role only).
create table if not exists public.whatsapp_numbers (
  phone_number_id  text primary key,                 -- Meta's id for the number (WhatsApp Manager -> API setup)
  firm_id          uuid not null unique references public.firms(id) on delete cascade,
  display_number   text not null default '',
  access_token     text not null default '',         -- empty = the platform's WHATSAPP_ACCESS_TOKEN
  created_at       timestamptz not null default now()
);
alter table public.whatsapp_numbers enable row level security;

create table if not exists public.whatsapp_conversations (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  firm_id                 uuid not null references public.firms(id) on delete cascade,
  client_phone            text not null,               -- digits with country code, as WhatsApp sends it: 919820012345
  client_name             text not null default '',    -- their WhatsApp profile name
  mode                    text not null default 'ai' check (mode in ('ai', 'human')),  -- human: the team took over
  last_message_at         timestamptz not null default now(),
  last_client_message_at  timestamptz,                 -- replies are only allowed within 24 hours of this
  enquiry_saved           boolean not null default false,
  handover_reason         text not null default '',    -- why Riya passed the chat to the team
  unique (firm_id, client_phone)
);
alter table public.whatsapp_conversations add column if not exists handover_reason text not null default '';
create index if not exists whatsapp_conversations_firm_idx on public.whatsapp_conversations (firm_id, last_message_at desc);

create table if not exists public.whatsapp_messages (
  id               bigint generated always as identity primary key,
  created_at       timestamptz not null default now(),
  firm_id          uuid not null references public.firms(id) on delete cascade,
  conversation_id  uuid not null references public.whatsapp_conversations(id) on delete cascade,
  direction        text not null check (direction in ('in', 'out')),
  sender           text not null check (sender in ('client', 'ai', 'team')),
  body             text not null default '',
  wa_message_id    text unique,                        -- Meta's id: the same incoming message is handled once
  input_tokens     integer not null default 0,         -- AI cost of this reply
  output_tokens    integer not null default 0,
  error            text
);
create index if not exists whatsapp_messages_conversation_idx on public.whatsapp_messages (conversation_id, created_at);
create index if not exists whatsapp_messages_firm_idx on public.whatsapp_messages (firm_id, created_at desc);

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
drop policy if exists "Firm reads its WhatsApp conversations" on public.whatsapp_conversations;
drop policy if exists "Firm reads its WhatsApp messages" on public.whatsapp_messages;
create policy "Firm reads its WhatsApp conversations" on public.whatsapp_conversations
  for select to authenticated using (public.is_platform_admin() or firm_id = public.my_firm_id());
create policy "Firm reads its WhatsApp messages" on public.whatsapp_messages
  for select to authenticated using (public.is_platform_admin() or firm_id = public.my_firm_id());
