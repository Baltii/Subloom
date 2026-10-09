-- Versioned JSON contracts are indexed by generated relational columns.
-- Every authenticated mutation goes through apply_operation, never a direct client write.
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(data) = 'object')
);
create table public.service_catalog (
  id text primary key, name text not null, category text not null, management_url text
);
insert into public.service_catalog values
 ('netflix','Netflix','Entertainment','https://www.netflix.com/YourAccount'),
 ('spotify','Spotify','Music','https://www.spotify.com/account/subscription/'),
 ('youtube','YouTube Premium','Entertainment','https://www.youtube.com/paid_memberships'),
 ('icloud','iCloud+','Cloud & storage','https://support.apple.com/en-us/118428'),
 ('google','Google One','Cloud & storage','https://one.google.com/settings'),
 ('chatgpt','ChatGPT','Productivity','https://chatgpt.com/#settings/Account'),
 ('adobe','Adobe Creative Cloud','Productivity','https://account.adobe.com/plans'),
 ('microsoft','Microsoft 365','Productivity','https://account.microsoft.com/services'),
 ('amazon','Amazon Prime','Entertainment','https://www.amazon.com/prime'),
 ('notion','Notion','Productivity','https://www.notion.so/settings'),
 ('figma','Figma','Productivity','https://www.figma.com/settings'),
 ('gym','Gym membership','Health & fitness',null);
create table public.subscriptions (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null, version integer not null check (version > 0),
  name text generated always as (data->>'name') stored not null,
  amount_minor bigint generated always as ((data->>'amountMinor')::bigint) stored not null check (amount_minor between 0 and 1000000000),
  currency text generated always as (data->>'currency') stored not null check (currency in ('USD','EUR','GBP','CAD','AUD','TND','JPY','CHF','AED','INR')),
  status text generated always as (data->>'status') stored not null check (status in ('active','trial','paused','canceled','expired')),
  next_renewal text generated always as (data->>'nextRenewal') stored not null,
  category text generated always as (data->>'category') stored not null,
  updated_at timestamptz not null default now(),
  unique (id,user_id),
  check (length(name) between 1 and 80),
  check (data->>'id' = id::text and data->>'userId' = user_id::text and (data->>'version')::int = version),
  check (data->>'interval' in ('weekly','monthly','quarterly','yearly','custom')),
  check ((data->>'intervalCount')::int between 1 and 365),
  check ((data->>'anchorDay')::int between 1 and 31),
  check (length(data->>'notes') <= 2000),
  check (length(data->>'paymentMethod') <= 80)
);
create index subscriptions_user_renewal on public.subscriptions(user_id, next_renewal);
create index subscriptions_user_status on public.subscriptions(user_id,status);
create table public.detected_candidates (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  fingerprint text generated always as (data->>'fingerprint') stored not null,
  state text generated always as (data->>'state') stored not null check (state in ('pending','confirmed','dismissed')),
  created_at timestamptz not null default now(),
  unique (user_id,fingerprint), unique (id,user_id),
  check (data->>'id' = id::text),
  check (length(data->>'merchant') <= 80),
  check ((data->>'confidence')::numeric between 0 and 1),
  check (octet_length(data::text) < 8192)
);
create index candidates_user_state on public.detected_candidates(user_id,state);
create table public.subscription_activity (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null, created_at timestamptz not null default now(),
  check (octet_length(data::text) < 4096)
);
create index activity_user_time on public.subscription_activity(user_id,created_at desc);
create table public.detection_sources (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('forwarded_email','screenshot','connected_email')), enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.detection_evidence_metadata (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null, provider_message_id text, sender_hash text, fingerprint text not null,
  received_at timestamptz not null default now(),
  foreign key (candidate_id,user_id) references public.detected_candidates(id,user_id) on delete cascade,
  unique(user_id,provider_message_id)
);
create table public.inbound_email_aliases (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  address text not null unique, token_hash text not null unique,
  expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now()
);
create table public.connected_accounts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check(provider in ('gmail','outlook')), status text not null default 'disconnected',
  -- Reserved for a separately reviewed integration; no provider tokens are stored in this MVP.
  created_at timestamptz not null default now()
);
create table public.push_devices (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  token text not null check (token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'),
  platform text not null check(platform in ('ios','android')), enabled boolean not null default true,
  updated_at timestamptz not null default now(), unique(user_id,token)
);
create table public.notification_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null unique, subscription_id uuid,
  subscription_version int, kind text not null check (kind in ('renewal','trial','candidate','digest','welcome')),
  payload jsonb not null, due_at timestamptz not null, invalidated_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (subscription_id,user_id) references public.subscriptions(id,user_id) on delete cascade
);
create index events_due on public.notification_events(due_at) where invalidated_at is null;
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.notification_events(id) on delete cascade,
  channel text not null check(channel in ('push','email')), destination text not null,
  status text not null default 'pending' check(status in ('pending','sending','accepted','delivered','failed','suppressed','unknown')),
  attempts int not null default 0, next_attempt_at timestamptz not null default now(),
  lease_until timestamptz, lease_token uuid, provider_id text, error_code text, delivered_at timestamptz,
  created_at timestamptz not null default now(), unique(event_id,channel,destination)
);
create index deliveries_work on public.notification_deliveries(status,next_attempt_at);
create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  delivery_id uuid not null unique references public.notification_deliveries(id) on delete cascade,
  provider_id text unique, status text not null, updated_at timestamptz not null default now()
);
create table public.user_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade, plan text not null default 'free' check(plan in ('free','pro')),
  updated_at timestamptz not null default now()
);
create table public.operation_results (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  entity_id text not null, result jsonb not null, created_at timestamptz not null default now()
);
create table public.webhook_receipts (
  id text primary key, user_id uuid references auth.users(id) on delete cascade,
  state text not null default 'processing', processed_at timestamptz, created_at timestamptz not null default now()
);
create table public.rate_limit_buckets (
  bucket text primary key, user_id uuid references auth.users(id) on delete cascade,
  window_start timestamptz not null, count int not null default 0
);

-- RLS everywhere. Only explicit grants/policies enable access; worker tables are service-only.
do $$
declare t text;
begin
  foreach t in array array['profiles','user_preferences','subscriptions','detected_candidates','subscription_activity','detection_sources','detection_evidence_metadata','inbound_email_aliases','connected_accounts','push_devices','notification_events','notification_deliveries','email_deliveries','user_entitlements','operation_results','webhook_receipts','rate_limit_buckets'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
  foreach t in array array['profiles','user_preferences','subscriptions','detected_candidates','subscription_activity','detection_sources','detection_evidence_metadata','inbound_email_aliases','connected_accounts','push_devices','notification_events','notification_deliveries','email_deliveries','user_entitlements','operation_results'] loop
    execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid()) = user_id)',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;
alter table public.service_catalog enable row level security;
create policy catalog_read on public.service_catalog for select to anon,authenticated using (true);
grant select on public.service_catalog to anon,authenticated;
grant all on public.service_catalog to service_role;
create policy device_insert on public.push_devices for insert to authenticated with check ((select auth.uid()) = user_id);
create policy device_update on public.push_devices for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy device_delete on public.push_devices for delete to authenticated using ((select auth.uid()) = user_id);
grant insert,update,delete on public.push_devices to authenticated;

create function public.initialize_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id) values(new.id);
  insert into public.user_entitlements(user_id) values(new.id);
  return new;
end $$;
create trigger user_created after insert on auth.users for each row execute function public.initialize_profile();
revoke execute on function public.initialize_profile() from public,anon,authenticated;

create function public.validate_subscription(d jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
declare k text;
begin
  foreach k in array array['id','userId','name','category','amountMinor','currency','interval','intervalCount','customUnit','startDate','nextRenewal','anchorDay','status','paymentMethod','notes','source','createdAt','updatedAt','version'] loop
    if d->>k is null then return false; end if;
  end loop;
  if jsonb_typeof(d->'amountMinor') <> 'number' or (d->>'amountMinor') !~ '^[0-9]+$' then return false; end if;
  if d->>'category' not in ('Entertainment','Music','Productivity','Cloud & storage','Health & fitness','Education','Other') then return false; end if;
  if d->>'customUnit' not in ('day','week','month','year') or d->>'source' not in ('manual','receipt','screenshot','notification','connected_email') then return false; end if;
  if length(d->>'name') not between 1 and 80 or length(d->>'paymentMethod') > 80 or length(d->>'notes') > 2000 then return false; end if;
  foreach k in array array['startDate','nextRenewal','trialEnd','paidThrough','canceledAt'] loop
    if d->>k is not null then
      if (d->>k) !~ '^\d{4}-\d{2}-\d{2}$' or (d->>k)::date::text <> d->>k then return false; end if;
    end if;
  end loop;
  if d->>'status' = 'trial' and d->>'trialEnd' is null then return false; end if;
  if d->'reminders' is not null and d->'reminders' <> 'null'::jsonb then
    if jsonb_typeof(d->'reminders'->'enabled') <> 'boolean' or jsonb_typeof(d->'reminders'->'days') <> 'array' then return false; end if;
    if jsonb_array_length(d->'reminders'->'days') > 10 or exists(select 1 from jsonb_array_elements_text(d->'reminders'->'days') v where v !~ '^\d{1,2}$' or v::int > 30) then return false; end if;
  end if;
  return true;
exception when others then return false;
end $$;
create function public.validate_preferences(d jsonb) returns boolean language plpgsql stable set search_path = '' as $$
declare k text;
begin
  foreach k in array array['pushEnabled','emailEnabled','trialReminders','weeklyDigest','privacyMode'] loop
    if jsonb_typeof(d->k) is distinct from 'boolean' then return false; end if;
  end loop;
  if d->>'appearance' not in ('system','light','dark') or d->>'currency' not in ('USD','EUR','GBP','CAD','AUD','TND','JPY','CHF','AED','INR') then return false; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name = d->>'timezone') then return false; end if;
  foreach k in array array['reminderHour','quietStart','quietEnd'] loop
    if d->>k is null or (d->>k) !~ '^\d{1,2}$' or (d->>k)::int not between 0 and 23 then return false; end if;
  end loop;
  if jsonb_typeof(d->'reminderDays') is distinct from 'array' then return false; end if;
  if jsonb_array_length(d->'reminderDays') > 10 or exists(select 1 from jsonb_array_elements_text(d->'reminderDays') v where v !~ '^\d{1,2}$' or v::int > 30) then return false; end if;
  return true;
exception when others then return false;
end $$;
create function public.apply_operation(operation jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  owner uuid := auth.uid(); operation_id uuid := (operation->>'id')::uuid;
  entity text := operation->>'entity'; entity_id uuid; payload jsonb := operation->'payload';
  s jsonb; c jsonb; a jsonb; previous_version int; expected int := (operation->>'expectedVersion')::int;
  result jsonb; current_state text;
begin
  if owner is null then raise exception 'Authentication required'; end if;
  if octet_length(operation::text) > 16000 then raise exception 'Operation too large'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner::text,0));
  select r.result into result from public.operation_results r where r.id = operation_id and r.user_id = owner;
  if found then return result; end if;
  if exists(select 1 from public.operation_results where id = operation_id) then raise exception 'Invalid operation identity'; end if;
  if operation->>'action' not in ('put','delete') then raise exception 'Invalid operation'; end if;
  if entity = 'preferences' then
    if not public.validate_preferences(payload) then raise exception 'Invalid preferences'; end if;
    insert into public.user_preferences(user_id,data) values(owner,payload)
      on conflict(user_id) do update set data = excluded.data, updated_at = now();
    -- Workers re-read current preferences immediately before a provider call.
  elsif entity in ('subscription','confirmation') then
    entity_id := (operation->>'entityId')::uuid;
    select version into previous_version from public.subscriptions where id=entity_id and user_id=owner for update;
    if previous_version is distinct from expected then raise exception 'Sync conflict'; end if;
    if exists(select 1 from public.subscriptions where id=entity_id and user_id<>owner) then raise exception 'Invalid subscription identity'; end if;
    if operation->>'action' = 'delete' then
      delete from public.subscriptions where id=entity_id and user_id=owner;
    else
      s := payload->'subscription';
      if s->>'id' <> entity_id::text or not public.validate_subscription(s) then raise exception 'Invalid subscription'; end if;
      s := jsonb_set(jsonb_set(s,'{userId}',to_jsonb(owner::text)),'{version}',to_jsonb(coalesce(previous_version,0)+1));
      insert into public.subscriptions(id,user_id,data,version) values(entity_id,owner,s,coalesce(previous_version,0)+1)
        on conflict(id) do update set data=excluded.data,version=excluded.version,updated_at=now() where subscriptions.user_id=owner;
      update public.notification_events set invalidated_at=now() where subscription_id=entity_id and user_id=owner and invalidated_at is null;
      if entity='confirmation' then
        c := payload->'candidate';
        select state into current_state from public.detected_candidates where id=(c->>'id')::uuid and user_id=owner for update;
        if current_state is distinct from 'pending' then raise exception 'Candidate already reviewed or not owned'; end if;
        update public.detected_candidates set data=jsonb_set(jsonb_set(data,'{state}','"confirmed"'::jsonb),'{matchedSubscriptionId}',to_jsonb(entity_id::text)) where id=(c->>'id')::uuid and user_id=owner;
      end if;
    end if;
  elsif entity='candidate' then
    c := payload->'candidate'; entity_id := (operation->>'entityId')::uuid;
    if c->>'id' <> entity_id::text or jsonb_typeof(c) <> 'object' then raise exception 'Invalid candidate'; end if;
    if exists(select 1 from public.detected_candidates where id=entity_id and user_id<>owner) then raise exception 'Invalid candidate identity'; end if;
    if c->>'matchedSubscriptionId' is not null and not exists(select 1 from public.subscriptions where id=(c->>'matchedSubscriptionId')::uuid and user_id=owner) then raise exception 'Invalid candidate match'; end if;
    select state into current_state from public.detected_candidates where id=entity_id and user_id=owner for update;
    if current_state in ('confirmed','dismissed') and c->>'state' <> current_state then raise exception 'Candidate already reviewed'; end if;
    if current_state is null and c->>'state' <> 'pending' then raise exception 'New candidates must be pending'; end if;
    if c->>'state'='confirmed' then raise exception 'Use confirmation operation'; end if;
    insert into public.detected_candidates(id,user_id,data) values(entity_id,owner,c)
      on conflict(id) do update set data=excluded.data where detected_candidates.user_id=owner;
  else raise exception 'Unknown operation entity'; end if;
  a := payload->'activity';
  if a is not null then
    if length(a->>'title') > 160 or length(a->>'detail') > 300 then raise exception 'Invalid activity'; end if;
    insert into public.subscription_activity(id,user_id,data) values((a->>'id')::uuid,owner,a) on conflict(id) do nothing;
  end if;
  result := jsonb_build_object('ok',true,'version',coalesce(previous_version,0)+1);
  insert into public.operation_results(id,user_id,entity_id,result) values(operation_id,owner,operation->>'entityId',result);
  return result;
end $$;
revoke execute on function public.validate_subscription(jsonb),public.validate_preferences(jsonb),public.apply_operation(jsonb) from public,anon,authenticated;
grant execute on function public.apply_operation(jsonb) to authenticated;

create function public.take_rate_limit(key text, maximum int, window_seconds int, owner uuid default null) returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.rate_limit_buckets(bucket,user_id,window_start,count) values(key,owner,now(),1)
  on conflict(bucket) do update set
    count=case when rate_limit_buckets.window_start < now()-make_interval(secs=>window_seconds) then 1 else rate_limit_buckets.count+1 end,
    window_start=case when rate_limit_buckets.window_start < now()-make_interval(secs=>window_seconds) then now() else rate_limit_buckets.window_start end
  returning count into n;
  return n<=maximum;
end $$;
create function public.claim_deliveries(batch_size int default 50) returns setof public.notification_deliveries language plpgsql security definer set search_path = '' as $$
begin
  -- A crash after push submission is ambiguous: never blindly re-send an expired push lease.
  update public.notification_deliveries set status='unknown',error_code='lease_expired_after_submission'
    where status='sending' and channel='push' and lease_until<now();
  -- Email retries keep the same provider idempotency key within the supported 24-hour window.
  update public.notification_deliveries set status='pending',lease_until=null
    where status='sending' and channel='email' and lease_until<now() and created_at>now()-interval '23 hours';
  update public.notification_deliveries set status='failed',error_code='retry_window_expired'
    where status in ('sending','pending') and created_at<now()-interval '23 hours';
  return query
  with picked as (
    select d.id from public.notification_deliveries d join public.notification_events e on e.id=d.event_id
    where d.status='pending' and d.next_attempt_at<=now() and e.due_at<=now() and e.invalidated_at is null and d.attempts<5
    order by d.created_at for update of d skip locked limit greatest(1,least(batch_size,100))
  )
  update public.notification_deliveries d set status='sending', attempts=attempts+1,
    lease_until=now()+interval '2 minutes',lease_token=gen_random_uuid()
  from picked where d.id=picked.id returning d.*;
end $$;
revoke execute on function public.take_rate_limit(text,int,int,uuid),public.claim_deliveries(int) from public,anon,authenticated;
grant execute on function public.take_rate_limit(text,int,int,uuid),public.claim_deliveries(int) to service_role;
