-- =============================================================
-- Clients: each firm's buyers and tenants in one place, with what they want, where they are in the deal, and the
-- listings that match them (features/clients).
--  - clients:          one row per person per firm (by phone). Filled automatically from website enquiries, the AI
--                      chatbot, portal leads, WhatsApp and Riya's calls, or added by the team.
--  - client_matches:   a listing that fits a client's requirement, and what the team did with it.
--  - client_activities: the client's history (enquiries, calls, stage changes, shares, notes). ref makes each
--                      enquiry or call count once.
-- Run once in Supabase: SQL Editor -> New query -> Run. Safe to run again. Needs 01–07.
-- =============================================================

create table if not exists public.clients (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  firm_id          uuid not null references public.firms(id) on delete cascade,
  name             text not null default '' check (char_length(name) <= 120),
  phone            text not null check (char_length(phone) between 7 and 20),   -- +919820012345
  email            text not null default '',
  source           text not null default 'manual',     -- website, chat, whatsapp, portal:99acres, call, manual
  stage            text not null default 'new'
                   check (stage in ('new', 'contacted', 'site_visit', 'negotiation', 'won', 'lost')),
  next_follow_up   date,
  notes            text not null default '',
  -- What they want. Empty / null = not known yet.
  req_deal         text not null default '' check (req_deal in ('', 'buy', 'rent')),
  req_type         text not null default '' check (req_type in ('', 'flat', 'villa', 'plot', 'office', 'shop')),
  req_bhk_min      smallint,
  req_bhk_max      smallint,
  req_budget_min   bigint,                              -- rupees; monthly rent for rentals
  req_budget_max   bigint,
  req_areas        text[] not null default '{}',        -- areas or regions as the client said them
  req_notes        text not null default '',            -- anything else: timeline, floor, furnishing, project
  req_updated_at   timestamptz,
  last_activity_at timestamptz not null default now(),
  unique (firm_id, phone)
);
create index if not exists clients_firm_stage_idx on public.clients (firm_id, stage, last_activity_at desc);
create index if not exists clients_follow_up_idx on public.clients (firm_id, next_follow_up);

create table if not exists public.client_matches (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  listing_id  uuid not null references public.listings(id) on delete cascade,
  score       smallint not null default 0,              -- 0-100: how well the listing fits
  reasons     text[] not null default '{}',             -- "Powai ✓", "2 BHK ✓", "₹1.2 Cr, budget ₹1.3 Cr"
  status      text not null default 'new'
              check (status in ('new', 'shared', 'interested', 'not_interested', 'dismissed')),
  shared_at   timestamptz,
  unique (client_id, listing_id)
);
create index if not exists client_matches_firm_idx on public.client_matches (firm_id, status, created_at desc);
create index if not exists client_matches_listing_idx on public.client_matches (listing_id);

create table if not exists public.client_activities (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  kind        text not null,                            -- enquiry, call, stage, note, share, follow_up
  body        text not null default '',
  ref         text,                                     -- 'enquiry:<id>' / 'call:<id>': each is taken in once
  unique (firm_id, ref)
);
create index if not exists client_activities_client_idx on public.client_activities (client_id, created_at desc);

-- A firm reads and changes only its own clients. The server also writes with the secret key after its own checks.
alter table public.clients enable row level security;
alter table public.client_matches enable row level security;
alter table public.client_activities enable row level security;
do $$
declare t text;
begin
  foreach t in array array['clients', 'client_matches', 'client_activities'] loop
    execute format('drop policy if exists "Firm reads its %1$s" on public.%1$s', t);
    execute format('drop policy if exists "Firm changes its %1$s" on public.%1$s', t);
    execute format('create policy "Firm reads its %1$s" on public.%1$s for select to authenticated using (public.is_platform_admin() or firm_id = public.my_firm_id())', t);
    execute format('create policy "Firm changes its %1$s" on public.%1$s for all to authenticated using (public.can_manage_firm(firm_id)) with check (public.can_manage_firm(firm_id))', t);
  end loop;
end $$;
