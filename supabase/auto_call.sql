-- =============================================================
-- Automatic AI calls for new website enquiries.
-- When an enquiry arrives for a firm that has auto-calling on, a call is queued for about a minute
-- later (or 9 am IST if it arrives at night). The website's /api/voice/process-queue places due
-- calls; Supabase pg_cron pings it every minute (see auto_call_cron.sql, run separately with the secret).
-- Run once in Supabase: SQL Editor -> New query -> Run. Safe to run again. Needs ai_calls.sql.
-- =============================================================

alter table public.firms add column if not exists ai_auto_call_enquiries boolean not null default false;

create table if not exists public.call_queue (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  contact_id  uuid not null references public.call_contacts(id) on delete cascade,
  enquiry_id  uuid references public.enquiries(id) on delete set null,
  run_after   timestamptz not null default now(),
  status      text not null default 'pending' check (status in ('pending', 'processing', 'placed', 'skipped', 'failed')),
  attempts    integer not null default 0,
  call_id     uuid references public.calls(id) on delete set null,
  note        text
);
create index if not exists call_queue_due_idx on public.call_queue (status, run_after);
create index if not exists call_queue_contact_idx on public.call_queue (contact_id, created_at desc);

alter table public.call_queue enable row level security;
drop policy if exists "Firm reads its call queue" on public.call_queue;
create policy "Firm reads its call queue" on public.call_queue
  for select to authenticated using (public.is_platform_admin() or firm_id = public.my_firm_id());

-- The given moment if it is inside 9 am - 9 pm IST, otherwise the next 9 am IST.
create or replace function public.next_calling_time(t timestamptz) returns timestamptz
language sql stable as $$
  select case
    when extract(hour from t at time zone 'Asia/Kolkata') between 9 and 20 then t
    when extract(hour from t at time zone 'Asia/Kolkata') >= 21
      then (date_trunc('day', t at time zone 'Asia/Kolkata') + interval '1 day 9 hours') at time zone 'Asia/Kolkata'
    else (date_trunc('day', t at time zone 'Asia/Kolkata') + interval '9 hours') at time zone 'Asia/Kolkata'
  end
$$;

-- Runs after every new enquiry. Never blocks the enquiry itself: any problem just skips the call.
create or replace function public.queue_enquiry_call() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  f public.firms;
  digits text;
  contact public.call_contacts;
  details text;
begin
  select * into f from public.firms where id = new.firm_id;
  if f.id is null or not f.active or not f.ai_calls_enabled or not f.ai_auto_call_enquiries then
    return new;
  end if;

  -- Indian mobiles only: "098200 12345" / "+91 98200 12345" -> +919820012345
  digits := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
  if length(digits) = 11 and left(digits, 1) = '0' then digits := substr(digits, 2); end if;
  if length(digits) = 12 and left(digits, 2) = '91' then digits := substr(digits, 3); end if;
  if digits !~ '^[6-9][0-9]{9}$' then return new; end if;

  details := concat_ws('. ', (select 'Asked about: ' || l.title from public.listings l where l.id = new.listing_id), nullif(trim(new.message), ''));

  insert into public.call_contacts (firm_id, name, phone, source, enquiry_id, context, notes, consent_confirmed, created_by)
  values (new.firm_id, left(coalesce(new.name, ''), 120), '+91' || digits, 'website', new.id,
          'They filled a property enquiry form on our website.', left(coalesce(details, ''), 500), true, null)
  on conflict (firm_id, phone) do update
    set enquiry_id = excluded.enquiry_id,
        notes = case when excluded.notes <> '' then excluded.notes else public.call_contacts.notes end
  returning * into contact;

  if contact.status = 'do_not_call' then return new; end if;
  -- At most one automatic call per number per day, even if the form is sent again.
  if exists (select 1 from public.call_queue q where q.contact_id = contact.id and q.created_at > now() - interval '24 hours') then
    return new;
  end if;

  insert into public.call_queue (firm_id, contact_id, enquiry_id, run_after)
  values (new.firm_id, contact.id, new.id, public.next_calling_time(now() + interval '1 minute'));
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists enquiries_queue_call on public.enquiries;
create trigger enquiries_queue_call after insert on public.enquiries
  for each row execute function public.queue_enquiry_call();
