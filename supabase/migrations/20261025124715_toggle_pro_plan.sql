-- Keep the existing paid rules and records; only their enforcement is switchable.
-- This defaults to the current behavior until configure:plans applies the env flag.
create table private.plan_configuration (
  singleton boolean primary key default true check (singleton),
  pro_plan_enabled boolean not null default true
);
alter table private.plan_configuration enable row level security;
revoke all on private.plan_configuration from public, anon, authenticated, service_role;
insert into private.plan_configuration(singleton, pro_plan_enabled) values(true, true);

-- Only the non-secret mode is public. Clients cannot change the configuration.
create function public.pro_plan_enabled() returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select pro_plan_enabled from private.plan_configuration where singleton), true);
$$;
revoke all on function public.pro_plan_enabled() from public;
grant execute on function public.pro_plan_enabled() to anon, authenticated, service_role;

create or replace function public.save_feature_setting(setting_key text, setting_data jsonb, expected_version bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint; previous jsonb; paid boolean; method_kind text;
begin
 if auth.uid() is null or expected_version is null or expected_version<0 then raise exception 'Sign in and supply a version'; end if;
 -- Also serialize first inserts so concurrent devices cannot bypass checks.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text || ':' || setting_key,0));
 select data into previous from public.feature_settings where user_id=auth.uid() and key=setting_key;
 select (not public.pro_plan_enabled()) or exists(select 1 from public.pro_billing where user_id=auth.uid()
   and status in ('trialing','active') and not payment_blocked
   and access_until>now() and verified_at>now()-interval '72 hours') into paid;
 if setting_key='payment_sources' then
   if jsonb_typeof(setting_data->'sources') is distinct from 'array' then raise exception 'Invalid billing methods'; end if;
   if jsonb_array_length(setting_data->'sources')>50 then raise exception 'At most 50 billing methods are supported'; end if;
   if exists(select 1 from jsonb_array_elements(setting_data->'sources') n
      where jsonb_typeof(n->'id') is distinct from 'string' or length(n->>'id')=0
        or coalesce(n->>'kind','') not in ('card','wallet','bank'))
      or (select count(*) <> count(distinct n->>'id') from jsonb_array_elements(setting_data->'sources') n)
      then raise exception 'Invalid billing methods'; end if;
   if not paid then
     foreach method_kind in array array['card','wallet','bank'] loop
       if (select count(*) from jsonb_array_elements(setting_data->'sources') n where n->>'kind'=method_kind)
          > (case when method_kind='bank' then 0 else 1 end)
         and exists(select 1 from jsonb_array_elements(setting_data->'sources') n
           where n->>'kind'=method_kind and not exists(
             select 1 from jsonb_array_elements(coalesce(previous->'sources','[]'::jsonb)) p
             where p->>'id'=n->>'id' and p->>'kind'=n->>'kind'))
         then raise exception 'Pro is required for more than one card or one wallet'; end if;
     end loop;
   end if;
 elsif setting_key='payment_transactions' then
   if jsonb_typeof(setting_data) is distinct from 'array' then raise exception 'Invalid transactions'; end if;
   if not paid and exists(select 1 from jsonb_array_elements(setting_data) n where not exists(
     select 1 from jsonb_array_elements(coalesce(previous,'[]'::jsonb)) p where p->>'id'=n->>'id'))
     then raise exception 'Pro is required to import statements'; end if;
 end if;
 if expected_version=0 then
   insert into public.feature_settings(user_id,key,data) values(auth.uid(),setting_key,setting_data) on conflict do nothing returning version into result;
 else
   update public.feature_settings set data=setting_data,version=version+1 where user_id=auth.uid() and key=setting_key and version=expected_version returning version into result;
 end if;
 if result is null then raise exception 'Settings conflict'; end if;
 return result;
end $$;
revoke all on function public.save_feature_setting(text,jsonb,bigint) from public,anon;
grant execute on function public.save_feature_setting(text,jsonb,bigint) to authenticated;


-- The trigger needs private billing reads; it is never exposed as an RPC.
create or replace function private.enforce_subscription_capacity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is distinct from new.user_id then raise exception 'Invalid subscription owner'; end if;
  if tg_op='UPDATE' then
    if new.user_id is distinct from old.user_id then raise exception 'Invalid subscription owner'; end if;
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text || ':subscriptions',0));
  -- INSERT ON CONFLICT also fires BEFORE INSERT; edits must remain possible.
  if exists(select 1 from public.subscriptions where id=new.id and user_id=new.user_id) then return new; end if;
  if public.pro_plan_enabled()
    and (select count(*) from public.subscriptions where user_id=new.user_id)>=10
    and not exists(select 1 from public.pro_billing where user_id=new.user_id
      and status in ('trialing','active') and not payment_blocked
      and access_until>now() and verified_at>now()-interval '72 hours')
    then raise exception 'Pro is required for more than 10 subscriptions'; end if;
  return new;
end $$;
revoke all on function private.enforce_subscription_capacity() from public,anon,authenticated;
