-- =============================================================
-- Sales caller: every 5 minutes, Monday to Saturday in calling hours, ask the website to place the next
-- automatic sales call. Run AFTER 12_sales_caller.sql, in Supabase: SQL Editor -> New query.
-- 1. Replace YOUR_SITE with your website address (e.g. https://nexorautomate.netlify.app)
-- 2. Replace PASTE_CRON_SECRET_HERE with the same CRON_SECRET you set in Netlify (as in supabase/cron/auto_call_cron.sql).
-- Don't commit the file with the real secret in it. Safe to run again (it replaces the old schedule).
-- The ping is only sent while automatic calling is switched on.
-- =============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'sales-caller';

-- 04:00 to 13:59 UTC = 9:30 am to 7:29 pm IST; the website itself only calls 10 am to 7 pm.
select cron.schedule('sales-caller', '*/5 4-13 * * 1-6', $job$
  select net.http_post(
    url := 'YOUR_SITE/api/sales-calls/run',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'PASTE_CRON_SECRET_HERE'),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  )
  where exists (select 1 from public.sales_caller_settings where enabled);
$job$);
