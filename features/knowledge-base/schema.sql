-- =============================================================
-- Knowledge base: Mumbai areas (with map positions, to tell near from far) and towers/projects
-- (which area each one is in, and an approximate price). One shared list for every firm, kept by
-- the platform owner. The AI assistant reads it through /api/voice/places with the server key.
-- Run once in Supabase: SQL Editor -> New query -> Run. Safe to run again. Needs multi_tenant.sql.
-- Then run seed.sql for the starting list.
-- =============================================================

create table if not exists public.kb_areas (
  name       text primary key,                      -- "Andheri West"
  zone       text not null,                         -- "Western suburbs", "South Mumbai", …
  lat        double precision not null,             -- rough centre of the area
  lng        double precision not null,
  aliases    text[] not null default '{}',          -- other ways callers say it: "Andheri (W)", "Lokhandwala"
  updated_at timestamptz not null default now()
);

create table if not exists public.kb_projects (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,             -- "Lodha Park"
  aliases         text[] not null default '{}',     -- "Lodha The Park", "Lodha World Park"
  area            text not null references public.kb_areas(name) on update cascade,
  developer       text,                             -- "Lodha"
  configurations  text,                             -- "2, 3 and 4 BHK"
  price_min_psf   integer,                          -- approximate rupees per sq ft (carpet), low end
  price_max_psf   integer,                          -- high end
  price_verified  boolean not null default false,   -- the assistant quotes a price only once this is ticked
  notes           text,
  updated_at      timestamptz not null default now(),
  constraint kb_price_range check (price_min_psf is null or price_max_psf is null or price_min_psf <= price_max_psf)
);

create index if not exists kb_projects_area on public.kb_projects(area);

alter table public.kb_areas enable row level security;
alter table public.kb_projects enable row level security;

-- Only the platform owner reads and edits it in the admin panel; the assistant's API uses the server key.
drop policy if exists "Platform admin manages areas" on public.kb_areas;
create policy "Platform admin manages areas" on public.kb_areas
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "Platform admin manages projects" on public.kb_projects;
create policy "Platform admin manages projects" on public.kb_projects
  for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
