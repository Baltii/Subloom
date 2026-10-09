create function public.claim_webhook(event_id text, owner uuid) returns text language plpgsql security definer set search_path = '' as $$
declare current public.webhook_receipts;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(event_id,0));
  select * into current from public.webhook_receipts where id=event_id for update;
  if found then
    if current.state='done' then return 'done'; end if;
    if current.state='processing' and current.created_at>now()-interval '2 minutes' then return 'busy'; end if;
    update public.webhook_receipts set state='processing',created_at=now() where id=event_id;
  else insert into public.webhook_receipts(id,user_id) values(event_id,owner); end if;
  return 'claimed';
end $$;
create function public.create_receipt_alias(owner uuid, alias_address text, hash text, expires timestamptz) returns uuid language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner::text,0));
  if (select count(*) from public.inbound_email_aliases where user_id=owner and revoked_at is null and expires_at>now())>=3 then raise exception 'Alias limit'; end if;
  insert into public.inbound_email_aliases(user_id,address,token_hash,expires_at) values(owner,alias_address,hash,expires) returning id into result;
  return result;
end $$;
revoke execute on function public.claim_webhook(text,uuid),public.create_receipt_alias(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_webhook(text,uuid),public.create_receipt_alias(uuid,text,text,timestamptz) to service_role;
