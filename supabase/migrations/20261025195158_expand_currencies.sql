-- Expand supported currencies without changing ownership or data contracts.
create or replace function public.validate_preferences(d jsonb) returns boolean language plpgsql stable set search_path = '' as $$
declare k text;
begin
  foreach k in array array['pushEnabled','emailEnabled','trialReminders','weeklyDigest','privacyMode'] loop
    if jsonb_typeof(d->k) is distinct from 'boolean' then return false; end if;
  end loop;
  if d->>'appearance' not in ('system','light','dark') or d->>'currency' not in ('USD','EUR','GBP','CAD','AUD','TND','JPY','CHF','AED','INR','CNY','HKD','NZD','SGD','KRW','SEK','NOK','DKK','PLN','CZK','HUF','RON','TRY','BRL','MXN','ZAR','SAR','QAR','KWD','BHD','OMR','EGP','MAD','DZD','JOD','IDR','MYR','THB','PHP','VND','PKR','BDT','LKR','NPR','NGN','KES','GHS','UAH','ILS','ISK','CLP','COP','PEN','ARS','XOF','XAF') then return false; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name = d->>'timezone') then return false; end if;
  foreach k in array array['reminderHour','quietStart','quietEnd'] loop
    if d->>k is null or (d->>k) !~ '^\d{1,2}$' or (d->>k)::int not between 0 and 23 then return false; end if;
  end loop;
  if jsonb_typeof(d->'reminderDays') is distinct from 'array' then return false; end if;
  if jsonb_array_length(d->'reminderDays') > 10 or exists(select 1 from jsonb_array_elements_text(d->'reminderDays') v where v !~ '^\d{1,2}$' or v::int > 30) then return false; end if;
  return true;
exception when others then return false;
end $$;

create or replace function public.validate_candidate(d jsonb) returns boolean language plpgsql immutable set search_path = '' as $$
declare k text;
begin
  foreach k in array array['id','merchant','serviceId','amountMinor','currency','interval','chargeDate','nextRenewal','trialEnd','confidence','source','fingerprint','reference','missingFields','explanation','kind','matchedSubscriptionId','state','createdAt'] loop
    if not d ? k then return false; end if;
  end loop;
  if d->>'id' is null or d->>'merchant' is null or d->>'fingerprint' is null or d->>'explanation' is null then return false; end if;
  if length(d->>'merchant')>80 or length(d->>'fingerprint')>128 or length(d->>'explanation')>600 or length(d->>'reference')>160 then return false; end if;
  if jsonb_typeof(d->'confidence') is distinct from 'number' or (d->>'confidence')::numeric not between 0 and 1 then return false; end if;
  if d->>'amountMinor' is not null and (jsonb_typeof(d->'amountMinor')<>'number' or d->>'amountMinor' !~ '^[0-9]+$' or (d->>'amountMinor')::bigint not between 0 and 1000000000) then return false; end if;
  if d->>'currency' is not null and d->>'currency' not in ('USD','EUR','GBP','CAD','AUD','TND','JPY','CHF','AED','INR','CNY','HKD','NZD','SGD','KRW','SEK','NOK','DKK','PLN','CZK','HUF','RON','TRY','BRL','MXN','ZAR','SAR','QAR','KWD','BHD','OMR','EGP','MAD','DZD','JOD','IDR','MYR','THB','PHP','VND','PKR','BDT','LKR','NPR','NGN','KES','GHS','UAH','ILS','ISK','CLP','COP','PEN','ARS','XOF','XAF') then return false; end if;
  if d->>'interval' is not null and d->>'interval' not in ('weekly','monthly','quarterly','yearly','custom') then return false; end if;
  if d->>'source' is null or d->>'source' not in ('receipt','screenshot','connected_email') then return false; end if;
  if d->>'kind' is null or d->>'kind' not in ('new','renewal','price_change','cancellation','refund','one_time','unknown') then return false; end if;
  foreach k in array array['chargeDate','nextRenewal','trialEnd'] loop
    if d->>k is not null and ((d->>k) !~ '^\d{4}-\d{2}-\d{2}$' or (d->>k)::date::text<>d->>k) then return false; end if;
  end loop;
  if jsonb_typeof(d->'missingFields') is distinct from 'array' then return false; end if;
  if jsonb_array_length(d->'missingFields')>10 or exists(select 1 from jsonb_array_elements(d->'missingFields') v where jsonb_typeof(v)<>'string') then return false; end if;
  perform (d->>'createdAt')::timestamptz;
  return true;
exception when others then return false;
end $$;

create or replace function private.valid_finance_journal(value jsonb) returns boolean
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
     or item->>'currency' not in ('USD','EUR','GBP','CAD','AUD','TND','JPY','CHF','AED','INR','CNY','HKD','NZD','SGD','KRW','SEK','NOK','DKK','PLN','CZK','HUF','RON','TRY','BRL','MXN','ZAR','SAR','QAR','KWD','BHD','OMR','EGP','MAD','DZD','JOD','IDR','MYR','THB','PHP','VND','PKR','BDT','LKR','NPR','NGN','KES','GHS','UAH','ILS','ISK','CLP','COP','PEN','ARS','XOF','XAF')
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

alter table public.subscriptions drop constraint subscriptions_currency_check;
alter table public.subscriptions add constraint subscriptions_currency_check check (currency in ('USD','EUR','GBP','CAD','AUD','TND','JPY','CHF','AED','INR','CNY','HKD','NZD','SGD','KRW','SEK','NOK','DKK','PLN','CZK','HUF','RON','TRY','BRL','MXN','ZAR','SAR','QAR','KWD','BHD','OMR','EGP','MAD','DZD','JOD','IDR','MYR','THB','PHP','VND','PKR','BDT','LKR','NPR','NGN','KES','GHS','UAH','ILS','ISK','CLP','COP','PEN','ARS','XOF','XAF'));
alter table public.workspace_ledger drop constraint workspace_ledger_currency_check;
alter table public.workspace_ledger add constraint workspace_ledger_currency_check check (currency in ('USD','EUR','GBP','CAD','AUD','TND','JPY','CHF','AED','INR','CNY','HKD','NZD','SGD','KRW','SEK','NOK','DKK','PLN','CZK','HUF','RON','TRY','BRL','MXN','ZAR','SAR','QAR','KWD','BHD','OMR','EGP','MAD','DZD','JOD','IDR','MYR','THB','PHP','VND','PKR','BDT','LKR','NPR','NGN','KES','GHS','UAH','ILS','ISK','CLP','COP','PEN','ARS','XOF','XAF'));
alter table public.exchange_rates drop constraint exchange_rates_quote_currency_check;
alter table public.exchange_rates add constraint exchange_rates_quote_currency_check check (quote_currency in ('EUR','GBP','CAD','AUD','TND','JPY','CHF','AED','INR','CNY','HKD','NZD','SGD','KRW','SEK','NOK','DKK','PLN','CZK','HUF','RON','TRY','BRL','MXN','ZAR','SAR','QAR','KWD','BHD','OMR','EGP','MAD','DZD','JOD','IDR','MYR','THB','PHP','VND','PKR','BDT','LKR','NPR','NGN','KES','GHS','UAH','ILS','ISK','CLP','COP','PEN','ARS','XOF','XAF'));
