-- User-recorded family charges, receipts and requests. No money movement.
create table public.workspace_ledger (
 id uuid primary key,
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 recorded_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check (kind in ('charge','settlement','request')),
 payer uuid not null references auth.users(id) on delete cascade,
 payee uuid references auth.users(id) on delete cascade,
 currency text not null check (currency in ('USD','EUR','GBP','CAD','AUD','TND','JPY','CHF','AED','INR')),
 amount_minor bigint not null check (amount_minor between 1 and 1000000000),
 event_date date not null check (event_date between date '2000-01-01' and date '2100-12-31'),
 subscription_id uuid,
 shares jsonb not null default '[]'::jsonb check (jsonb_typeof(shares)='array' and jsonb_array_length(shares)<=50 and octet_length(shares::text)<=16384),
 note text not null check (length(trim(note)) between 1 and 160),
 due_date date,
 voided boolean not null default false,
 version integer not null default 1 check (version>0),
 created_at timestamptz not null default now(),
 check (payee is null or payer<>payee),
 check ((kind='charge' and payee is null and due_date is null) or (kind in ('settlement','request') and payee is not null and subscription_id is null and shares='[]'::jsonb)),
 check (kind='request' or due_date is null)
);
create index workspace_ledger_scope on public.workspace_ledger(workspace_id,event_date,id);
create unique index workspace_ledger_unique_charge on public.workspace_ledger(workspace_id,subscription_id,event_date) where kind='charge' and not voided;
alter table public.workspace_ledger enable row level security;
revoke all on public.workspace_ledger from public,anon,authenticated;
grant select,insert on public.workspace_ledger to authenticated;
grant update(voided) on public.workspace_ledger to authenticated;
create policy family_ledger_read on public.workspace_ledger for select to authenticated using (public.workspace_member(workspace_id));
create policy family_ledger_insert on public.workspace_ledger for insert to authenticated with check (recorded_by=(select auth.uid()) and public.workspace_member(workspace_id));
create policy family_ledger_correct on public.workspace_ledger for update to authenticated using (public.workspace_member(workspace_id) and (recorded_by=(select auth.uid()) or exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid())))) with check (public.workspace_member(workspace_id) and (recorded_by=(select auth.uid()) or exists(select 1 from public.workspaces w where w.id=workspace_id and w.owner_id=(select auth.uid()))));
create schema if not exists private;
create function private.validate_family_ledger() returns trigger language plpgsql security invoker set search_path='' as $$
declare owner uuid; subscription public.workspace_subscriptions;
begin
 select w.owner_id into owner from public.workspaces w where w.id=new.workspace_id and w.kind='family';
 if auth.uid() is null or owner is null or not public.workspace_member(new.workspace_id) then raise exception 'Family membership required'; end if;
 if TG_OP='UPDATE' then
   if old.recorded_by<>auth.uid() and owner<>auth.uid() then raise exception 'Recorder or owner access required'; end if;
   if (to_jsonb(new)-'voided'-'version')<>(to_jsonb(old)-'voided'-'version') then raise exception 'Ledger facts are immutable; void and record a correction'; end if;
   new.version=old.version+1; return new;
 end if;
 if new.recorded_by<>auth.uid() or new.voided or new.version<>1 then raise exception 'Record entries under your own identity'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('family-ledger:'||new.workspace_id::text,0));
 if (select count(*) from public.workspace_ledger l where l.workspace_id=new.workspace_id)>=2000 then raise exception 'Ledger history is full; export it before starting a new workspace ledger'; end if;
 new.created_at=clock_timestamp();
 if not exists(select 1 from public.workspace_members m where m.workspace_id=new.workspace_id and m.user_id=new.payer) or (new.payee is not null and not exists(select 1 from public.workspace_members m where m.workspace_id=new.workspace_id and m.user_id=new.payee)) then raise exception 'Choose current workspace participants'; end if;
 if new.kind='charge' then
   select * into subscription from public.workspace_subscriptions s where s.id=new.subscription_id and s.workspace_id=new.workspace_id;
   if not found or subscription.managed_by<>new.payer or (subscription.data->>'currency')<>new.currency or (subscription.data->>'amountMinor')::bigint<>new.amount_minor or subscription.shares<>new.shares then raise exception 'Reload the current shared price, billing owner and split'; end if;
   if auth.uid()<>owner and auth.uid()<>new.payer then raise exception 'Billing owner or workspace owner must confirm the paid charge'; end if;
 elsif auth.uid()<>owner and auth.uid()<>new.payee then raise exception 'Recipient or workspace owner must record receipts and requests'; end if;
 return new;
end $$;
revoke all on function private.validate_family_ledger() from public,anon,authenticated;
create trigger validate_family_ledger before insert or update on public.workspace_ledger for each row execute function private.validate_family_ledger();
create function public.workspace_ledger_history(scope uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.workspace_member(scope) then raise exception 'Workspace membership required'; end if;
 select coalesce(jsonb_agg(to_jsonb(l) order by l.event_date desc,l.id),'[]'::jsonb) into result from public.workspace_ledger l where l.workspace_id=scope;
 if jsonb_array_length(result)>2000 then raise exception 'Ledger history exceeds the supported review limit; balances were not calculated'; end if;
 return result;
end $$;
revoke all on function public.workspace_ledger_history(uuid) from public,anon;
grant execute on function public.workspace_ledger_history(uuid) to authenticated;
