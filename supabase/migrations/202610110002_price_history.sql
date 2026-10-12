create table public.subscription_price_history (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 subscription_id uuid not null,
 subscription_version integer not null check(subscription_version>0),
 data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<4096),
 unique(subscription_id,subscription_version),
 foreign key(subscription_id,user_id) references public.subscriptions(id,user_id) on delete cascade
);
create index price_history_owner on public.subscription_price_history(user_id,subscription_id,subscription_version);
alter table public.subscription_price_history enable row level security;
revoke all on public.subscription_price_history from anon,authenticated;
grant select on public.subscription_price_history to authenticated;
create policy owned_price_history on public.subscription_price_history for select to authenticated using(user_id=(select auth.uid()));
create function public.capture_subscription_price() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' or (old.data->'amountMinor',old.data->'currency',old.data->'interval',old.data->'intervalCount',old.data->'customUnit') is distinct from (new.data->'amountMinor',new.data->'currency',new.data->'interval',new.data->'intervalCount',new.data->'customUnit') then
 insert into public.subscription_price_history(user_id,subscription_id,subscription_version,data) values(new.user_id,new.id,new.version,jsonb_build_object('subscriptionId',new.id,'version',new.version,'amountMinor',new.data->'amountMinor','currency',new.data->'currency','interval',new.data->'interval','intervalCount',new.data->'intervalCount','customUnit',new.data->'customUnit','capturedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'source','recorded')) on conflict do nothing;
 end if;
 return new;
end $$;
revoke all on function public.capture_subscription_price() from public,anon,authenticated;
create trigger subscription_price_capture after insert or update on public.subscriptions for each row execute function public.capture_subscription_price();
insert into public.subscription_price_history(user_id,subscription_id,subscription_version,data) select user_id,id,version,jsonb_build_object('subscriptionId',id,'version',version,'amountMinor',data->'amountMinor','currency',data->'currency','interval',data->'interval','intervalCount',data->'intervalCount','customUnit',data->'customUnit','capturedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'source','baseline') from public.subscriptions;
