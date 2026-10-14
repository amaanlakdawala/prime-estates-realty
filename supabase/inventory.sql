-- =============================================================
-- Inventory the AI assistant can search even when it is not on a website.
--  - listings.show_on_website: false = private listing (team + AI assistant only, never public)
--  - firms.website_enabled:    false = the firm has no public website (admin panel and AI calling still work)
-- The public (anon) can only read available listings that are on the website of a live firm website.
-- The AI assistant's search reads all available listings of the firm with the server key.
-- Run once in Supabase: SQL Editor -> New query -> Run. Safe to run again. Needs multi_tenant.sql.
-- =============================================================

alter table public.listings add column if not exists show_on_website boolean not null default true;
alter table public.firms add column if not exists website_enabled boolean not null default true;

-- True when the firm is active AND has its public website switched on.
create or replace function public.firm_site_live(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select active and website_enabled from public.firms where id = f), false)
$$;

drop policy if exists "Public reads available listings" on public.listings;
create policy "Public reads available listings" on public.listings
  for select to anon
  using (status = 'available' and show_on_website and public.firm_site_live(firm_id));
