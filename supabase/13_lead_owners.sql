-- =============================================================
-- Lead owners: the person who runs each brokerage (owner, proprietor, founder, partner), found on the web
-- by lib/lead-owner.js when leads are found, or with "Find owner" on a lead's page.
-- Run once in Supabase: SQL Editor -> New query -> Run. Safe to run again. Needs 03_leads.sql.
-- =============================================================

alter table public.leads
  add column if not exists owner_name       text not null default '',
  add column if not exists owner_role       text not null default '',  -- Owner, Proprietor, Founder, Partner, Director
  add column if not exists owner_source     text not null default '',  -- where it was found, in one line
  add column if not exists owner_checked_at timestamptz;                -- last web search, found or not
