create table public.exchange_rates (
 base_currency text not null check (base_currency='USD'),
 quote_currency text not null check (quote_currency in ('EUR','GBP','CAD','AUD','TND','JPY','CHF','AED','INR')),
 rate numeric(28,12) not null check (rate > 0 and rate <= 1000000),
 as_of date not null,
 fetched_at timestamptz not null default now(),
 provider text not null check (provider='frankfurter'),
 primary key(base_currency,quote_currency,as_of)
);
alter table public.exchange_rates enable row level security;
revoke all on public.exchange_rates from public,anon,authenticated;
grant select on public.exchange_rates to anon,authenticated;
grant all on public.exchange_rates to service_role;
create policy public_reference_rates on public.exchange_rates for select to anon,authenticated using (true);
create view public.latest_exchange_rates with (security_invoker=true) as
 select distinct on (base_currency,quote_currency) base_currency,quote_currency,rate::text as rate,as_of,fetched_at,provider
 from public.exchange_rates order by base_currency,quote_currency,as_of desc;
grant select on public.latest_exchange_rates to anon,authenticated,service_role;
