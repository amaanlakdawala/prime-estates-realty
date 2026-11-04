-- Records which team member added each listing, so an admin can see it on that person's Team page.
-- Run once in Supabase: SQL Editor -> New query -> Run. Safe to run again.
-- Listings added before this was run show no owner.

alter table public.listings
  add column if not exists created_by uuid default auth.uid() references auth.users(id) on delete set null;

create index if not exists listings_created_by_idx on public.listings (created_by);
