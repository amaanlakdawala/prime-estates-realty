-- =============================================================
-- Multi-firm upgrade: one database serves every client firm.
-- Each firm sees and changes only its own listings, enquiries and photos.
-- The platform admin (role 'admin' in app_metadata) sees everything.
--
-- Run once in Supabase: SQL Editor -> New query -> Run. Safe to run again.
-- Needs schema.sql to have been run first.
-- =============================================================

-- Who added each listing (same as add_listing_owner.sql, repeated so this file is enough on its own).
alter table public.listings
  add column if not exists created_by uuid default auth.uid() references auth.users(id) on delete set null;
create index if not exists listings_created_by_idx on public.listings (created_by);

-- ---------- Firms ----------
create table if not exists public.firms (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  slug          text not null unique
                check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 40),  -- the web address part: /seabreeze
  name          text not null check (char_length(name) between 1 and 120),
  city          text not null default '',
  phone         text not null default '',
  whatsapp      text not null default '',   -- empty = same as phone
  email         text not null default '',
  address       text not null default '',
  hours         text not null default '',
  rera_no       text not null default '',   -- MahaRERA agent number; empty hides every MahaRERA mention
  founded_year  smallint,
  localities    text[] not null default '{}',
  logo_url      text not null default '',
  hero_url      text not null default '',   -- photo behind the home page headline; empty = sample collage
  demo_content  boolean not null default false,  -- sample testimonials and team; demo firms only
  active        boolean not null default true    -- false hides the website and blocks the firm's login
);

-- Which firm each client login belongs to. Platform admins have no row here.
create table if not exists public.firm_users (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  firm_id     uuid not null references public.firms(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists firm_users_firm_idx on public.firm_users (firm_id);

-- ---------- Tag listings and enquiries with their firm ----------
alter table public.listings  add column if not exists firm_id uuid references public.firms(id) on delete cascade;
alter table public.enquiries add column if not exists firm_id uuid references public.firms(id) on delete cascade;

-- Everything that existed before becomes the demo firm "Prime Estates Realty" at /prime-estates.
insert into public.firms (slug, name, city, phone, email, address, hours, founded_year, localities, demo_content)
values (
  'prime-estates', 'Prime Estates Realty', 'Pune', '+91 80975 46742', 'info@primeestatesrealty.com',
  'Office 402, Sai Heritage, Baner Road, Baner, Pune 411045', 'Monday to Saturday, 10 am to 7 pm', 2012,
  array['Baner','Balewadi','Aundh','Wakad','Hinjewadi','Pimple Saudagar','Kothrud','Kharadi','Viman Nagar','Hadapsar'],
  true
)
on conflict (slug) do nothing;

update public.listings  set firm_id = (select id from public.firms where slug = 'prime-estates') where firm_id is null;
update public.enquiries set firm_id = (select id from public.firms where slug = 'prime-estates') where firm_id is null;

alter table public.listings  alter column firm_id set not null;
alter table public.enquiries alter column firm_id set not null;
create index if not exists listings_firm_idx  on public.listings (firm_id);
create index if not exists enquiries_firm_idx on public.enquiries (firm_id);

-- ---------- Helpers used by the security rules ----------
create or replace function public.is_platform_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

-- security definer: reads firm_users without tripping that table's own security rules.
create or replace function public.my_firm_id() returns uuid
language sql stable security definer set search_path = public as $$
  select firm_id from public.firm_users where user_id = auth.uid()
$$;

create or replace function public.firm_is_active(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select active from public.firms where id = f), false)
$$;

create or replace function public.listing_in_firm(l uuid, f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.listings where id = l and firm_id = f)
$$;

-- True for you (everything) or for a login acting on its own, active firm.
create or replace function public.can_manage_firm(f uuid) returns boolean
language sql stable as $$
  select public.is_platform_admin() or (f = public.my_firm_id() and public.firm_is_active(f))
$$;

-- ---------- Row Level Security ----------
alter table public.firms      enable row level security;
alter table public.firm_users enable row level security;

-- Firms: a website visitor can read an active firm's public details. Changes go through the
-- server with the secret key only, so there are no insert/update/delete rules here.
drop policy if exists "Read firms" on public.firms;
create policy "Read firms" on public.firms
  for select to anon, authenticated
  using (active or public.is_platform_admin() or id = public.my_firm_id());

drop policy if exists "Read own firm membership" on public.firm_users;
create policy "Read own firm membership" on public.firm_users
  for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

-- Listings: visitors see available listings of active firms. Logins see and change only their firm's.
drop policy if exists "Public reads available listings" on public.listings;
create policy "Public reads available listings" on public.listings
  for select to anon
  using (status = 'available' and public.firm_is_active(firm_id));

drop policy if exists "Employees read listings"   on public.listings;
drop policy if exists "Employees add listings"    on public.listings;
drop policy if exists "Employees update listings" on public.listings;
drop policy if exists "Employees delete listings" on public.listings;
drop policy if exists "Firm reads its listings"   on public.listings;
drop policy if exists "Firm adds its listings"    on public.listings;
drop policy if exists "Firm updates its listings" on public.listings;
drop policy if exists "Firm deletes its listings" on public.listings;

create policy "Firm reads its listings" on public.listings
  for select to authenticated using (public.is_platform_admin() or firm_id = public.my_firm_id());
create policy "Firm adds its listings" on public.listings
  for insert to authenticated with check (public.can_manage_firm(firm_id));
create policy "Firm updates its listings" on public.listings
  for update to authenticated using (public.can_manage_firm(firm_id)) with check (public.can_manage_firm(firm_id));
create policy "Firm deletes its listings" on public.listings
  for delete to authenticated using (public.can_manage_firm(firm_id));

-- Enquiries: anyone can send one to an active firm (about that firm's own listing, if any).
drop policy if exists "Anyone sends an enquiry"    on public.enquiries;
drop policy if exists "Employees read enquiries"   on public.enquiries;
drop policy if exists "Employees delete enquiries" on public.enquiries;
drop policy if exists "Firm reads its enquiries"   on public.enquiries;
drop policy if exists "Firm deletes its enquiries" on public.enquiries;

create policy "Anyone sends an enquiry" on public.enquiries
  for insert to anon, authenticated
  with check (public.firm_is_active(firm_id) and (listing_id is null or public.listing_in_firm(listing_id, firm_id)));
create policy "Firm reads its enquiries" on public.enquiries
  for select to authenticated using (public.is_platform_admin() or firm_id = public.my_firm_id());
create policy "Firm deletes its enquiries" on public.enquiries
  for delete to authenticated using (public.can_manage_firm(firm_id));

-- Photos: each firm uploads into a folder named after its firm id and can only touch that folder.
-- (Photos from before this upgrade sit in older folders; only the platform admin can manage those.)
drop policy if exists "Employees upload listing images" on storage.objects;
drop policy if exists "Employees update listing images" on storage.objects;
drop policy if exists "Employees delete listing images" on storage.objects;
drop policy if exists "Firm uploads its images" on storage.objects;
drop policy if exists "Firm updates its images" on storage.objects;
drop policy if exists "Firm deletes its images" on storage.objects;

create policy "Firm uploads its images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-images'
              and (public.is_platform_admin() or (storage.foldername(name))[1] = public.my_firm_id()::text));
create policy "Firm updates its images" on storage.objects
  for update to authenticated
  using (bucket_id = 'listing-images'
         and (public.is_platform_admin() or (storage.foldername(name))[1] = public.my_firm_id()::text));
create policy "Firm deletes its images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-images'
         and (public.is_platform_admin() or (storage.foldername(name))[1] = public.my_firm_id()::text));
