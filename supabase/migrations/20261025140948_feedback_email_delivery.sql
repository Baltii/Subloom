-- The feedback row doubles as a durable email outbox; client permissions stay closed.
alter table public.app_feedback
  add column email_sent_at timestamptz,
  add column email_provider_id text,
  add column email_attempts integer not null default 0 check (email_attempts between 0 and 8),
  add column email_first_attempt_at timestamptz,
  add column email_next_attempt_at timestamptz not null default now(),
  add column email_lease_token uuid,
  add column email_lease_until timestamptz,
  add column email_error text;
create index app_feedback_email_queue on public.app_feedback(email_next_attempt_at)
  where email_sent_at is null and email_attempts < 8;

create function public.claim_feedback_emails(batch_size integer, target_id uuid default null)
returns setof public.app_feedback language sql security invoker set search_path='' as $$
  with due as (
    select f.id from public.app_feedback f
    where f.email_sent_at is null and f.email_attempts < 8
      and f.email_next_attempt_at <= now()
      and (f.email_lease_until is null or f.email_lease_until < now())
      -- Resend retains idempotency keys for 24 hours. Never replay an uncertain
      -- send outside that window, even after an extended worker outage.
      and (f.email_first_attempt_at is null or f.email_first_attempt_at > now()-interval '23 hours')
      and (target_id is null or f.id=target_id)
    order by f.created_at, f.id
    limit least(greatest(coalesce(batch_size,1),1),5)
    for update skip locked
  )
  update public.app_feedback f set
    email_attempts=f.email_attempts+1,
    email_first_attempt_at=coalesce(f.email_first_attempt_at,now()),
    email_lease_token=gen_random_uuid(), email_lease_until=now()+interval '2 minutes'
  from due where f.id=due.id returning f.*;
$$;
revoke all on function public.claim_feedback_emails(integer,uuid) from public, anon, authenticated;
grant execute on function public.claim_feedback_emails(integer,uuid) to service_role;
