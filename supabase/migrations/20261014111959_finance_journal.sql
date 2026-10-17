-- Personal tracking metadata only. PANs, CVVs and provider credentials have no fields.
create schema if not exists private;
create function private.valid_finance_journal(value jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare item jsonb; ids text[]; tx_ids text[];
begin
 if jsonb_typeof(value) <> 'object' or (select count(*) from jsonb_object_keys(value)) <> 2
   or not (value ?& array['wallets','transactions'])
   or jsonb_typeof(value->'wallets') <> 'array' or jsonb_typeof(value->'transactions') <> 'array'
   or jsonb_array_length(value->'wallets') > 50 or jsonb_array_length(value->'transactions') > 300
   or octet_length(value::text) > 131072 then return false; end if;
 ids := array[]::text[]; tx_ids := array[]::text[];
 for item in select * from jsonb_array_elements(value->'wallets') loop
   if jsonb_typeof(item) <> 'object' or (select count(*) from jsonb_object_keys(item)) <> 5
     or not (item ?& array['id','name','kind','lastFour','archived']) then return false; end if;
   if exists (select 1 from jsonb_each(item) e where e.key = any(array['id','name','kind','lastFour','merchant','currency','date','status','source','createdAt']) and jsonb_typeof(e.value) <> 'string') then return false; end if;
   perform (item->>'id')::uuid;
   if item->>'id' = any(ids) or jsonb_typeof(item->'name') <> 'string' or length(btrim(item->>'name')) not between 1 and 80
     or regexp_replace(item->>'name','[ -]','','g') ~ '[0-9]{12,}'
     or item->>'kind' not in ('card','apple_wallet','google_wallet')
     or jsonb_typeof(item->'lastFour') <> 'string' or item->>'lastFour' !~ '^([0-9]{4})?$'
     or jsonb_typeof(item->'archived') <> 'boolean' then return false; end if;
   ids := array_append(ids,item->>'id');
 end loop;
 for item in select * from jsonb_array_elements(value->'transactions') loop
   if jsonb_typeof(item) <> 'object' or (select count(*) from jsonb_object_keys(item)) <> 11
     or not (item ?& array['id','merchant','amountMinor','currency','date','kind','status','walletId','subscriptionId','source','createdAt']) then return false; end if;
   if exists (select 1 from jsonb_each(item) e where e.key = any(array['id','name','kind','lastFour','merchant','currency','date','status','source','createdAt']) and jsonb_typeof(e.value) <> 'string') then return false; end if;
   perform (item->>'id')::uuid;
   -- Eleven fields in the client contract; reject arbitrary credential fields.
   if item->>'id' = any(tx_ids) or jsonb_typeof(item->'merchant') <> 'string' or length(btrim(item->>'merchant')) not between 1 and 80
     or regexp_replace(item->>'merchant','[ -]','','g') ~ '[0-9]{12,}'
     or jsonb_typeof(item->'amountMinor') <> 'number' or (item->>'amountMinor')::numeric not between 1 and 1000000000
     or (item->>'amountMinor')::numeric <> trunc((item->>'amountMinor')::numeric)
     or item->>'currency' not in ('USD','EUR','GBP','CAD','AUD','TND','JPY','CHF','AED','INR')
     or item->>'date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or ((item->>'date')::date)::text <> item->>'date'
     or item->>'kind' not in ('charge','refund') or item->>'status' not in ('settled','pending','failed')
     or item->>'source' <> 'manual' then return false; end if;
   perform (item->>'createdAt')::timestamptz;
   if jsonb_typeof(item->'walletId') <> 'null' then
     perform (item->>'walletId')::uuid;
     if not (item->>'walletId' = any(ids)) then return false; end if;
   end if;
   if jsonb_typeof(item->'subscriptionId') <> 'null' then perform (item->>'subscriptionId')::uuid; end if;
   tx_ids := array_append(tx_ids,item->>'id');
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function private.valid_finance_journal(jsonb) from public;
grant usage on schema private to authenticated,service_role;
grant execute on function private.valid_finance_journal(jsonb) to authenticated,service_role;
create table public.finance_journals (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check (private.valid_finance_journal(data)),
 version bigint not null default 1 check (version > 0)
);
alter table public.finance_journals enable row level security;
revoke all on public.finance_journals from anon,authenticated;
grant select,insert,update on public.finance_journals to authenticated;
grant all on public.finance_journals to service_role;
create policy owned_finance_read on public.finance_journals for select to authenticated using (user_id=(select auth.uid()));
create policy owned_finance_insert on public.finance_journals for insert to authenticated with check (user_id=(select auth.uid()) and version=1);
create policy owned_finance_update on public.finance_journals for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create function private.finance_journal_revision() returns trigger language plpgsql set search_path='' as $$
begin
 if new.user_id <> old.user_id or new.version <> old.version+1 then raise exception 'Financial record version conflict'; end if;
 return new;
end $$;
revoke all on function private.finance_journal_revision() from public;
create trigger finance_revision before update on public.finance_journals for each row execute function private.finance_journal_revision();
