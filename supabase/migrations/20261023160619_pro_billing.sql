-- Billing identities contain no tracked subscriptions, statements or card labels.
-- Only Edge Functions can read or write processor identifiers and entitlements.
create table public.pro_billing (
 user_id uuid primary key references auth.users(id) on delete cascade,
 customer_id text unique,
 subscription_id text unique,
 status text not null default 'none' check (status in ('none','trialing','active','past_due','unpaid','incomplete','incomplete_expired','canceled','paused')),
 interval text check (interval in ('month','year')),
 access_until timestamptz,
 trial_end timestamptz,
 cancel_at_period_end boolean not null default false,
 trial_used boolean not null default false,
 payment_blocked boolean not null default false,
 verified_at timestamptz,
 checkout_id text,
 checkout_interval text check (checkout_interval in ('month','year')),
 checkout_key uuid,
 lease_token uuid,
 lease_until timestamptz
);
create table public.pro_trial_history (
 email_hash text primary key check (length(email_hash)=64),
 used_at timestamptz not null default now()
);
create table public.pro_webhook_events (
 id text primary key,
 processed_at timestamptz not null default now()
);
alter table public.pro_billing enable row level security;
alter table public.pro_trial_history enable row level security;
alter table public.pro_webhook_events enable row level security;
revoke all on public.pro_billing, public.pro_trial_history, public.pro_webhook_events from public, anon, authenticated;
grant all on public.pro_billing, public.pro_trial_history, public.pro_webhook_events to service_role;

-- Serialize Checkout creation and canonical refreshes across devices and events.
create function public.claim_pro_billing(owner uuid, token uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare claimed public.pro_billing;
begin
 insert into public.pro_billing(user_id) values(owner) on conflict do nothing;
 update public.pro_billing set lease_token=token,lease_until=now()+interval '2 minutes'
 where user_id=owner and (lease_until is null or lease_until<now()) returning * into claimed;
 if claimed.user_id is null then return null; end if;
 return to_jsonb(claimed);
end $$;
revoke all on function public.claim_pro_billing(uuid,uuid) from public,anon,authenticated;
grant execute on function public.claim_pro_billing(uuid,uuid) to service_role;

-- Existing records remain editable after downgrade. Only new saved methods and
-- new statement records require capacity/Pro, including direct API writes.
create or replace function public.save_feature_setting(setting_key text, setting_data jsonb, expected_version bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint; previous jsonb; paid boolean; added boolean;
begin
 if auth.uid() is null or expected_version is null or expected_version<0 then raise exception 'Sign in and supply a version'; end if;
 -- Also serialize first inserts so concurrent devices cannot bypass checks.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text || ':' || setting_key,0));
 select data into previous from public.feature_settings where user_id=auth.uid() and key=setting_key;
 select exists(select 1 from public.pro_billing where user_id=auth.uid()
   and status in ('trialing','active') and not payment_blocked
   and access_until>now() and verified_at>now()-interval '72 hours') into paid;
 if setting_key='payment_sources' then
   if jsonb_typeof(setting_data->'sources') is distinct from 'array' then raise exception 'Invalid billing methods'; end if;
   select exists(select 1 from jsonb_array_elements(setting_data->'sources') n where not exists(
     select 1 from jsonb_array_elements(coalesce(previous->'sources','[]'::jsonb)) p where p->>'id'=n->>'id')) into added;
   if jsonb_array_length(setting_data->'sources')>50 or (not paid and added and jsonb_array_length(setting_data->'sources')>3)
     then raise exception 'Pro is required for more than 3 cards and wallets'; end if;
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
