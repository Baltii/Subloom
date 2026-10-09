-- Realtime carries only an owned revision marker, never deleted/private row payloads.
create table public.account_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1,
  changed_at timestamptz not null default now()
);
alter table public.account_sync_state enable row level security;
revoke all on public.account_sync_state from anon,authenticated;
grant select on public.account_sync_state to authenticated;
grant all on public.account_sync_state to service_role;
create policy owner_read on public.account_sync_state for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.mark_account_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  owner := case when TG_OP = 'DELETE' then OLD.user_id else NEW.user_id end;
  -- Auth deletion cascades through these tables; do not recreate a deleted account marker.
  if exists(select 1 from auth.users where id = owner) then
    insert into public.account_sync_state(user_id) values(owner)
      on conflict(user_id) do update set revision=account_sync_state.revision+1,changed_at=now();
  end if;
  return null;
end $$;
revoke execute on function public.mark_account_changed() from public,anon,authenticated;
do $$
declare t text;
begin
  foreach t in array array['subscriptions','detected_candidates','subscription_activity','user_preferences'] loop
    execute format('create trigger account_changed after insert or update or delete on public.%I for each row execute function public.mark_account_changed()',t);
  end loop;
  -- PGlite/local SQL tests have no Realtime publication.
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='account_sync_state'
  ) then
    alter publication supabase_realtime add table public.account_sync_state;
  end if;
end $$;
insert into public.account_sync_state(user_id) select id from auth.users;

create index push_device_token on public.push_devices(token);

-- Provider tokens rotate and installations can switch accounts. No account data is returned.
create function public.register_push_device(installation_id uuid,device_token text,device_platform text)
returns void language plpgsql security definer set search_path = '' as $$
declare owner uuid := auth.uid();
begin
  if owner is null then raise exception 'Authentication required'; end if;
  if installation_id is null or device_token is null or device_platform is null or
    device_platform not in ('ios','android') or device_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'
    then raise exception 'Invalid push device'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('push-owner:'||owner::text,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('push-token:'||device_token,0));
  if exists(select 1 from public.push_devices where id=installation_id and user_id<>owner) then
    raise exception 'Invalid installation identity';
  end if;
  if not exists(select 1 from public.push_devices where id=installation_id or (user_id=owner and token=device_token)) and
      (select count(*) from public.push_devices where user_id=owner) >= 20 then raise exception 'Device limit reached'; end if;
  -- Stop reminders to the previous account on the same physical destination.
  update public.push_devices set enabled=false,updated_at=now() where token=device_token and user_id<>owner;
  delete from public.push_devices where user_id=owner and token=device_token and id<>installation_id;
  insert into public.push_devices(id,user_id,token,platform,enabled)
    values(installation_id,owner,device_token,device_platform,true)
    on conflict(id) do update set token=excluded.token,platform=excluded.platform,enabled=true,updated_at=now()
      where push_devices.user_id=owner;
end $$;
create function public.disable_push_device(installation_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.push_devices set enabled=false,updated_at=now() where id=installation_id and user_id=auth.uid();
end $$;
revoke execute on function public.register_push_device(uuid,text,text),public.disable_push_device(uuid) from public,anon,authenticated;
grant execute on function public.register_push_device(uuid,text,text),public.disable_push_device(uuid) to authenticated;
revoke insert,update on public.push_devices from authenticated;

alter table public.notification_events drop constraint notification_events_kind_check;
alter table public.notification_events add constraint notification_events_kind_check
  check (kind in ('renewal','trial','candidate','digest','welcome','test'));
