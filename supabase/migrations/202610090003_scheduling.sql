alter table public.user_preferences add column next_check_at timestamptz not null default now();
alter table public.profiles add column email_suppressed boolean not null default false;
create index preferences_schedule_due on public.user_preferences(next_check_at);
create function public.claim_schedule_users(batch_size int default 25) returns setof public.user_preferences language sql security definer set search_path = '' as $$
  with picked as (
    select id from public.user_preferences where next_check_at<=now()
    order by next_check_at for update skip locked limit greatest(1,least(batch_size,100))
  )
  update public.user_preferences p set next_check_at=now()+interval '5 minutes'
  from picked where p.id=picked.id returning p.*;
$$;
revoke execute on function public.claim_schedule_users(int) from public,anon,authenticated;
grant execute on function public.claim_schedule_users(int) to service_role;
