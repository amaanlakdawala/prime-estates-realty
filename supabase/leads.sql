-- =============================================================
-- Lead finder: brokerages found on Google, and your outreach to them.
-- Platform admin only. Run once in Supabase: SQL Editor -> New query -> Run. Safe to run again.
-- Needs multi_tenant.sql (for firms and is_platform_admin) to have been run first.
-- =============================================================

create table if not exists public.leads (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  place_id           text not null unique,             -- Google's id for the business; re-searching updates, never duplicates
  name               text not null,
  phone              text not null default '',
  phone_intl         text not null default '',
  website            text not null default '',
  address            text not null default '',
  city               text not null default '',
  locality           text not null default '',          -- the area it was first found in
  rating             numeric(2,1),
  review_count       integer not null default 0,
  maps_url           text not null default '',
  score              smallint not null default 0,       -- higher = better prospect (see lib/leads.js)
  status             text not null default 'new'
                     check (status in ('new','contacted','interested','demo_sent','won','lost','do_not_contact')),
  next_follow_up     date,
  last_contacted_at  timestamptz,
  demo_firm_id       uuid references public.firms(id) on delete set null,
  last_refreshed_at  timestamptz not null default now()
);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_score_idx  on public.leads (score desc);

-- Calls, WhatsApps, notes and status changes, newest first on each lead's page.
create table if not exists public.lead_activities (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  kind        text not null check (kind in ('note','call','whatsapp','status','demo')),
  body        text not null default ''
);
create index if not exists lead_activities_lead_idx on public.lead_activities (lead_id, created_at desc);

-- The WhatsApp message used for outreach (one row).
create table if not exists public.outreach_template (
  id    smallint primary key default 1 check (id = 1),
  body  text not null
);
insert into public.outreach_template (id, body) values (1,
'Namaste {name} ji, I build websites for property brokers in {city}. I made a free sample website for {firm}: {demo_link}

Your own website means your enquiries come straight to you, not shared like on portals. Can I show you in 10 minutes this week?')
on conflict (id) do nothing;

-- Google requests per month, so the dashboard can stay inside the free allowance.
create table if not exists public.places_usage (
  month     text primary key,      -- 'YYYY-MM'
  requests  integer not null default 0
);

-- Adds n to this month's count and returns the new total, in one step.
create or replace function public.bump_places_usage(m text, n integer) returns integer
language sql as $$
  insert into public.places_usage (month, requests) values (m, n)
  on conflict (month) do update set requests = public.places_usage.requests + excluded.requests
  returning requests
$$;

-- ---------- Row Level Security: platform admin only ----------
alter table public.leads             enable row level security;
alter table public.lead_activities   enable row level security;
alter table public.outreach_template enable row level security;
alter table public.places_usage      enable row level security;

drop policy if exists "Platform admin manages leads"      on public.leads;
drop policy if exists "Platform admin manages activities" on public.lead_activities;
drop policy if exists "Platform admin manages template"   on public.outreach_template;
drop policy if exists "Platform admin reads usage"        on public.places_usage;

create policy "Platform admin manages leads" on public.leads
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "Platform admin manages activities" on public.lead_activities
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "Platform admin manages template" on public.outreach_template
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "Platform admin reads usage" on public.places_usage
  for select to authenticated using (public.is_platform_admin());

-- Only the server (secret key) may bump the counter.
revoke execute on function public.bump_places_usage(text, integer) from public, anon, authenticated;
grant execute on function public.bump_places_usage(text, integer) to service_role;
