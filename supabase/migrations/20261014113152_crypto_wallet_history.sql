create function private.valid_crypto_journal(value jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb; ids text[]:=array[]::text[]; addresses text[]:=array[]::text[]; subscriptions text[]:=array[]::text[];
begin
 if jsonb_typeof(value)<>'object' or (select count(*) from jsonb_object_keys(value))<>2 or not(value ?& array['wallets','intentions'])
   or jsonb_typeof(value->'wallets')<>'array' or jsonb_typeof(value->'intentions')<>'array'
   or jsonb_array_length(value->'wallets')>20 or jsonb_array_length(value->'intentions')>100 or octet_length(value::text)>32768 then return false;end if;
 for item in select * from jsonb_array_elements(value->'wallets') loop
  if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>3 or not(item ?& array['id','name','address'])
    or exists(select 1 from jsonb_each(item) e where jsonb_typeof(e.value)<>'string') then return false;end if;
  perform (item->>'id')::uuid;
  if item->>'id'=any(ids) or item->>'address'=any(addresses) or item->>'address' !~ '^bc1[qp][023456789acdefghjklmnpqrstuvwxyz]{38,59}$'
    or length(btrim(item->>'name')) not between 1 and 80 or regexp_replace(item->>'name','[ -]','','g') ~ '[0-9]{12,}' then return false;end if;
  ids:=array_append(ids,item->>'id');addresses:=array_append(addresses,item->>'address');
 end loop;
 for item in select * from jsonb_array_elements(value->'intentions') loop
  if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>3 or not(item ?& array['subscriptionId','mode','reviewDate'])
    or exists(select 1 from jsonb_each(item) e where jsonb_typeof(e.value)<>'string') then return false;end if;
  perform (item->>'subscriptionId')::uuid;
  if item->>'subscriptionId'=any(subscriptions) or item->>'mode' not in ('manual','renew','cancel')
    or item->>'reviewDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or ((item->>'reviewDate')::date)::text<>item->>'reviewDate' then return false;end if;
  subscriptions:=array_append(subscriptions,item->>'subscriptionId');
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function private.valid_crypto_journal(jsonb) from public;
grant execute on function private.valid_crypto_journal(jsonb) to authenticated,service_role;
create table public.crypto_journals (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check(private.valid_crypto_journal(data)),
 version bigint not null default 1 check(version>0)
);
alter table public.crypto_journals enable row level security;
revoke all on public.crypto_journals from anon,authenticated;
grant select,insert,update on public.crypto_journals to authenticated;
grant all on public.crypto_journals to service_role;
create policy owned_crypto_read on public.crypto_journals for select to authenticated using(user_id=(select auth.uid()));
create policy owned_crypto_insert on public.crypto_journals for insert to authenticated with check(user_id=(select auth.uid()) and version=1);
create policy owned_crypto_update on public.crypto_journals for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create function private.crypto_journal_revision() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.user_id<>old.user_id or new.version<>old.version+1 then raise exception 'Crypto record version conflict';end if;
  if exists(select 1 from jsonb_array_elements(old.data->'wallets') a join jsonb_array_elements(new.data->'wallets') b on a->>'id'=b->>'id' where a->>'address'<>b->>'address') then raise exception 'Watched addresses cannot change; add a new address';end if;
 end if;
 if exists(select 1 from jsonb_array_elements(new.data->'intentions') i where not exists(select 1 from public.subscriptions s where s.id=(i->>'subscriptionId')::uuid and s.user_id=new.user_id)) then raise exception 'Sync your owned subscription before saving its renewal preference';end if;
 return new;
end $$;
revoke all on function private.crypto_journal_revision() from public;
create trigger crypto_revision before insert or update on public.crypto_journals for each row execute function private.crypto_journal_revision();
create table public.crypto_address_history (
 user_id uuid not null references auth.users(id) on delete cascade,
 wallet_id uuid not null,
 address text not null,
 data jsonb not null check(jsonb_typeof(data)='object' and jsonb_typeof(data->'transactions')='array' and jsonb_array_length(data->'transactions')<=25 and octet_length(data::text)<=32768),
 primary key(user_id,wallet_id),
 foreign key(user_id) references public.crypto_journals(user_id) on delete cascade
);
alter table public.crypto_address_history enable row level security;
revoke all on public.crypto_address_history from anon,authenticated;
grant select on public.crypto_address_history to authenticated;
grant all on public.crypto_address_history to service_role;
create policy owned_crypto_history on public.crypto_address_history for select to authenticated using(user_id=(select auth.uid()));
