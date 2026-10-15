-- =============================================================
-- Social replies: automatic replies to comments on each firm's Instagram and Facebook.
-- Run once in Supabase: SQL Editor -> New query -> Run. Safe to run again. Needs supabase/multi_tenant.sql.
-- Firms read their own rows. Accounts, tokens and the comment log are written by the server only.
-- =============================================================

-- A connected Facebook Page or Instagram professional account.
create table if not exists public.social_accounts (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  firm_id       uuid not null references public.firms(id) on delete cascade,
  platform      text not null check (platform in ('facebook', 'instagram')),
  external_id   text not null,               -- Page ID or Instagram account ID
  name          text not null default '',    -- Page name or @handle, for display
  enabled       boolean not null default true,
  unique (platform, external_id)
);
create index if not exists social_accounts_firm_idx on public.social_accounts (firm_id);

-- Access tokens, kept apart so no firm login can ever read them (no policies = server only).
create table if not exists public.social_account_tokens (
  account_id    uuid primary key references public.social_accounts(id) on delete cascade,
  access_token  text not null,
  expires_at    timestamptz
);

-- Per-firm settings. Automatic replies start switched off.
create table if not exists public.social_settings (
  firm_id               uuid primary key references public.firms(id) on delete cascade,
  auto_reply            boolean not null default false,
  ai_replies            boolean not null default true,
  max_replies_per_hour  integer not null default 30 check (max_replies_per_hour between 0 and 500),
  sign_off              text not null default ''   -- e.g. "Team Prime Estates"
);

-- Keyword rules: the first enabled rule whose keyword appears in the comment wins.
create table if not exists public.social_rules (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  firm_id     uuid not null references public.firms(id) on delete cascade,
  keyword     text not null check (char_length(keyword) between 1 and 40),
  reply       text not null default '' check (char_length(reply) <= 500),     -- public reply under the comment
  dm          text not null default '' check (char_length(dm) <= 1000),       -- private message; empty = none
  platforms   text[] not null default '{facebook,instagram}',
  enabled     boolean not null default true,
  sort        integer not null default 0
);
create index if not exists social_rules_firm_idx on public.social_rules (firm_id, sort);

-- Every comment received and what was done with it.
create table if not exists public.social_comments (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  firm_id       uuid not null references public.firms(id) on delete cascade,
  account_id    uuid references public.social_accounts(id) on delete set null,
  platform      text not null check (platform in ('facebook', 'instagram')),
  comment_id    text not null,
  post_id       text,
  author_name   text not null default '',
  text          text not null default '',
  rule_id       uuid references public.social_rules(id) on delete set null,
  action        text not null check (action in ('replied', 'skipped', 'failed', 'held')),
  reason        text not null default '',     -- why it was skipped, held or failed
  reply_text    text,
  dm_text       text,
  dm_sent       boolean not null default false,
  unique (platform, comment_id)               -- a comment is handled once, even if Meta sends it twice
);
create index if not exists social_comments_firm_idx on public.social_comments (firm_id, created_at desc);

-- ---------- Row Level Security ----------
alter table public.social_accounts       enable row level security;
alter table public.social_account_tokens enable row level security;  -- no policies: server only
alter table public.social_settings       enable row level security;
alter table public.social_rules          enable row level security;
alter table public.social_comments       enable row level security;

drop policy if exists "Firm reads its social accounts" on public.social_accounts;
create policy "Firm reads its social accounts" on public.social_accounts
  for select to authenticated using (public.is_platform_admin() or firm_id = public.my_firm_id());

drop policy if exists "Firm reads its social settings" on public.social_settings;
create policy "Firm reads its social settings" on public.social_settings
  for select to authenticated using (public.is_platform_admin() or firm_id = public.my_firm_id());
drop policy if exists "Firm writes its social settings" on public.social_settings;
create policy "Firm writes its social settings" on public.social_settings
  for all to authenticated using (public.can_manage_firm(firm_id)) with check (public.can_manage_firm(firm_id));

drop policy if exists "Firm reads its social rules" on public.social_rules;
create policy "Firm reads its social rules" on public.social_rules
  for select to authenticated using (public.is_platform_admin() or firm_id = public.my_firm_id());
drop policy if exists "Firm writes its social rules" on public.social_rules;
create policy "Firm writes its social rules" on public.social_rules
  for all to authenticated using (public.can_manage_firm(firm_id)) with check (public.can_manage_firm(firm_id));

drop policy if exists "Firm reads its social comments" on public.social_comments;
create policy "Firm reads its social comments" on public.social_comments
  for select to authenticated using (public.is_platform_admin() or firm_id = public.my_firm_id());
