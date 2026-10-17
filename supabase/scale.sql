-- =============================================================
-- Production hardening and indexes for large numbers of firms, listings and visitors.
-- Run once in Supabase: SQL Editor -> New query -> Run. Safe to run again. Needs multi_tenant.sql and auto_call.sql.
-- =============================================================

-- 1. Enquiries are only written by the website's server (app/actions/enquiry.js), which checks for spam
--    and rate limits first. Visitors could otherwise insert rows directly with the public key, and every
--    enquiry can queue an automatic AI call to the number in it.
drop policy if exists "Anyone sends an enquiry" on public.enquiries;
alter table public.enquiries add column if not exists ip_hash text; -- a one-way hash of the sender's IP, for rate limits only
create index if not exists enquiries_ip_idx on public.enquiries (ip_hash, created_at desc);
create index if not exists enquiries_firm_created_idx on public.enquiries (firm_id, created_at desc);
create index if not exists enquiries_firm_phone_idx on public.enquiries (firm_id, phone, created_at desc);

-- 2. The queries every visitor and every call make.
create index if not exists listings_public_idx on public.listings (firm_id, status, created_at desc); -- a firm's available listings, newest first
create index if not exists listings_featured_idx on public.listings (firm_id, created_at desc) where featured and status = 'available';
create index if not exists calls_open_idx on public.calls (firm_id) where status in ('queued', 'in_progress'); -- the scheduler's "anything running?" checks
create index if not exists calls_contact_idx on public.calls (contact_id, status);
create index if not exists call_queue_pending_idx on public.call_queue (run_after) where status = 'pending';

-- 3. Listings and logins per firm for the Firms page, counted in the database. Reading every row to
--    count them stops being correct beyond 1,000 rows (the API's page size).
create or replace function public.firm_counts()
returns table (firm_id uuid, listings bigint, logins bigint)
language sql stable security definer set search_path = public as $$
  select f.id,
    (select count(*) from public.listings l where l.firm_id = f.id),
    (select count(*) from public.firm_users u where u.firm_id = f.id)
  from public.firms f
$$;
revoke all on function public.firm_counts() from public, anon, authenticated; -- server (service role) only
