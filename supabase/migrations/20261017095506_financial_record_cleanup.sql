-- Internal trigger functions only; no new client RPC or table privileges.
-- A removed watch must stop exposing saved explorer observations in exports.
create function private.prune_bitcoin_observations() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.crypto_address_history h
  where h.user_id = new.user_id
    and not exists (
      select 1 from jsonb_array_elements(new.data->'wallets') w
      where (w->>'id')::uuid = h.wallet_id
    );
  return new;
end $$;
revoke all on function private.prune_bitcoin_observations() from public, anon, authenticated;
create trigger prune_bitcoin_observations after update of data on public.crypto_journals
for each row execute function private.prune_bitcoin_observations();

-- Otherwise a deleted subscription leaves an intention that blocks every later
-- crypto-journal save. Bump the journal revision so other devices must reload.
create function private.prune_renewal_intentions() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.crypto_journals j
  set data = jsonb_set(j.data, '{intentions}', coalesce((
    select jsonb_agg(i) from jsonb_array_elements(j.data->'intentions') i
    where i->>'subscriptionId' <> old.id::text
  ), '[]'::jsonb)), version = j.version + 1
  where j.user_id = old.user_id
    and j.data->'intentions' @> jsonb_build_array(jsonb_build_object('subscriptionId', old.id::text))
    and exists (select 1 from auth.users u where u.id = old.user_id);
  return old;
end $$;
revoke all on function private.prune_renewal_intentions() from public, anon, authenticated;
create trigger prune_renewal_intentions after delete on public.subscriptions
for each row execute function private.prune_renewal_intentions();

-- Serialize explorer writes with journal updates: a refresh that started before
-- removal cannot resurrect observations for the removed address.
create function private.require_watched_bitcoin_address() returns trigger
language plpgsql set search_path = '' as $$
declare journal jsonb;
begin
  select data into journal from public.crypto_journals where user_id = new.user_id for update;
  if journal is null or not exists (
    select 1 from jsonb_array_elements(journal->'wallets') w
    where (w->>'id')::uuid = new.wallet_id and w->>'address' = new.address
  ) then raise exception 'Watched address is unavailable'; end if;
  return new;
end $$;
revoke all on function private.require_watched_bitcoin_address() from public, anon, authenticated;
create trigger require_watched_bitcoin_address before insert or update on public.crypto_address_history
for each row execute function private.require_watched_bitcoin_address();
