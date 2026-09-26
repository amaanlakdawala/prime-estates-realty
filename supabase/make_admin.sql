-- Run this once per person you want to make an admin (someone who can create
-- and remove other employees' logins from /admin/users).
-- Change the email below, then run in Supabase: SQL Editor -> New query -> Run.

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where email = 'amaanlakdawala301@gmail.com';
