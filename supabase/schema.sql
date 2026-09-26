-- =============================================================
-- Prime Estates Realty — database setup
-- Run this whole file once in Supabase: SQL Editor -> New query -> Run
-- =============================================================

create extension if not exists "pgcrypto";

-- ---------- Listings ----------
create table if not exists public.listings (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  title         text not null,
  property_type text not null check (property_type in ('flat','villa','plot','office','shop')),
  deal_type     text not null check (deal_type in ('buy','rent')),
  price         bigint not null check (price >= 0),   -- rupees; monthly rent when deal_type = 'rent'
  area_sqft     integer check (area_sqft >= 0),
  bhk           smallint check (bhk >= 0),
  floor         text,
  locality      text not null,
  address       text,
  latitude      double precision,
  longitude     double precision,
  description   text,
  amenities     text[] not null default '{}',
  rera_number   text,
  photos        text[] not null default '{}',          -- public image URLs, first one is the cover
  floor_plan    text,
  status        text not null default 'available' check (status in ('available','sold','rented')),
  featured      boolean not null default false
);

create index if not exists listings_status_idx   on public.listings (status);
create index if not exists listings_locality_idx on public.listings (locality);
create index if not exists listings_created_idx  on public.listings (created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists listings_updated_at on public.listings;
create trigger listings_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- ---------- Enquiries (leads from the website forms) ----------
create table if not exists public.enquiries (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 120),
  phone       text not null check (char_length(phone) between 7 and 20),
  email       text check (email is null or char_length(email) <= 200),
  message     text check (message is null or char_length(message) <= 2000),
  listing_id  uuid references public.listings(id) on delete set null,
  source      text not null default 'website'
);

create index if not exists enquiries_created_idx on public.enquiries (created_at desc);

-- ---------- Row Level Security ----------
-- Public visitors (anon) may only READ listings that are available.
-- Logged-in employees (authenticated) may read and change everything.
-- Public sign-ups must be disabled so that only accounts you create are "authenticated".

alter table public.listings  enable row level security;
alter table public.enquiries enable row level security;

drop policy if exists "Public reads available listings" on public.listings;
create policy "Public reads available listings" on public.listings
  for select to anon using (status = 'available');

drop policy if exists "Employees read listings" on public.listings;
create policy "Employees read listings" on public.listings
  for select to authenticated using (true);

drop policy if exists "Employees add listings" on public.listings;
create policy "Employees add listings" on public.listings
  for insert to authenticated with check (true);

drop policy if exists "Employees update listings" on public.listings;
create policy "Employees update listings" on public.listings
  for update to authenticated using (true) with check (true);

drop policy if exists "Employees delete listings" on public.listings;
create policy "Employees delete listings" on public.listings
  for delete to authenticated using (true);

drop policy if exists "Anyone sends an enquiry" on public.enquiries;
create policy "Anyone sends an enquiry" on public.enquiries
  for insert to anon, authenticated with check (true);

drop policy if exists "Employees read enquiries" on public.enquiries;
create policy "Employees read enquiries" on public.enquiries
  for select to authenticated using (true);

drop policy if exists "Employees delete enquiries" on public.enquiries;
create policy "Employees delete enquiries" on public.enquiries
  for delete to authenticated using (true);

-- ---------- Photo storage ----------
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

drop policy if exists "Public views listing images" on storage.objects;
create policy "Public views listing images" on storage.objects
  for select using (bucket_id = 'listing-images');

drop policy if exists "Employees upload listing images" on storage.objects;
create policy "Employees upload listing images" on storage.objects
  for insert to authenticated with check (bucket_id = 'listing-images');

drop policy if exists "Employees update listing images" on storage.objects;
create policy "Employees update listing images" on storage.objects
  for update to authenticated using (bucket_id = 'listing-images');

drop policy if exists "Employees delete listing images" on storage.objects;
create policy "Employees delete listing images" on storage.objects
  for delete to authenticated using (bucket_id = 'listing-images');
