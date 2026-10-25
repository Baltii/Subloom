-- Private submissions. App users cannot list, edit, or insert inbox rows directly.
-- The Edge Function validates, rate-limits and inserts using its server-only role.
create table public.app_feedback (
  id uuid primary key,
  kind text not null check (kind in ('idea','problem','feedback')),
  title text not null check (char_length(btrim(title)) between 3 and 120),
  message text not null check (char_length(btrim(message)) between 10 and 4000),
  reply_email text check (reply_email is null or (char_length(reply_email) between 3 and 254 and reply_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  platform text not null check (platform in ('web','ios','android','macos','windows')),
  app_version text not null check (char_length(btrim(app_version)) between 1 and 40),
  status text not null default 'new' check (status in ('new','reviewing','planned','closed')),
  created_at timestamptz not null default now()
);
create index app_feedback_inbox on public.app_feedback(status, created_at desc);
alter table public.app_feedback enable row level security;
revoke all on public.app_feedback from public, anon, authenticated;
grant select, insert, update, delete on public.app_feedback to service_role;
comment on table public.app_feedback is 'Private ideas and feedback. Review through the Supabase dashboard; only the server role has API access.';
