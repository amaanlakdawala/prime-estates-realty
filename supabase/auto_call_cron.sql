-- =============================================================
-- Every minute, ping the website so it places due automatic calls and saves call results.
-- Run AFTER auto_call.sql, in Supabase: SQL Editor -> New query.
-- 1. Replace YOUR_SITE with your website address (e.g. https://primeestaterealty.netlify.app)
-- 2. Replace PASTE_CRON_SECRET_HERE with the same CRON_SECRET you set in Netlify.
-- Don't commit the file with the real secret in it. Safe to run again (it replaces the old schedule).
-- The ping is only sent when there is something to do, so idle minutes cost nothing.
-- =============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'process-call-queue';

select cron.schedule('process-call-queue', '* * * * *', $job$
  select net.http_post(
    url := 'YOUR_SITE/api/voice/process-queue',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'PASTE_CRON_SECRET_HERE'),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  )
  where exists (select 1 from public.call_queue where status = 'pending' and run_after <= now())
     or exists (select 1 from public.calls where status in ('queued', 'in_progress'));
$job$);
