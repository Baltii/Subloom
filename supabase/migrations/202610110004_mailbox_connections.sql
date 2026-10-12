create table public.mailbox_connections(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id)on delete cascade,provider text not null check(provider in('gmail','outlook')),status text not null default 'pending' check(status in('pending','connected','disconnected')),generation bigint not null default 1,connected_at timestamptz,last_scanned_at timestamptz,scan_until timestamptz,unique(user_id,provider));
create table public.mailbox_credentials(connection_id uuid primary key references public.mailbox_connections(id)on delete cascade,sealed_tokens text not null check(length(sealed_tokens)<=32768));
create table public.mailbox_oauth_states(state_hash text primary key,connection_id uuid not null references public.mailbox_connections(id)on delete cascade,generation bigint not null,sealed_verifier text not null check(length(sealed_verifier)<=2048),return_kind text not null check(return_kind in('web','native')),expires_at timestamptz not null default now()+interval '10 minutes',claimed_at timestamptz);
create index mailbox_states_connection on public.mailbox_oauth_states(connection_id);
alter table public.mailbox_connections enable row level security;alter table public.mailbox_credentials enable row level security;alter table public.mailbox_oauth_states enable row level security;
revoke all on public.mailbox_connections,public.mailbox_credentials,public.mailbox_oauth_states from anon,authenticated;
grant select on public.mailbox_connections to authenticated;grant all on public.mailbox_connections,public.mailbox_credentials,public.mailbox_oauth_states to service_role;
create policy mailbox_metadata_owner on public.mailbox_connections for select to authenticated using(user_id=(select auth.uid()));
create function public.begin_mailbox_connection(owner uuid,mail_provider text,hash text,verifier text,target text)returns jsonb language plpgsql security definer set search_path='' as $$
declare connection public.mailbox_connections;
begin
 insert into public.mailbox_connections(user_id,provider)values(owner,mail_provider)on conflict(user_id,provider)do update set status='pending',generation=mailbox_connections.generation+1,scan_until=null where mailbox_connections.status<>'connected' returning * into connection;
 if connection.id is null then raise exception 'Disconnect this mailbox before connecting again';end if;
 delete from public.mailbox_credentials where connection_id=connection.id;delete from public.mailbox_oauth_states where connection_id=connection.id;
 insert into public.mailbox_oauth_states(state_hash,connection_id,generation,sealed_verifier,return_kind)values(hash,connection.id,connection.generation,verifier,target);
 return jsonb_build_object('id',connection.id,'generation',connection.generation);
end $$;
create function public.claim_mailbox_oauth(hash text)returns jsonb language plpgsql security definer set search_path='' as $$
declare state public.mailbox_oauth_states;connection public.mailbox_connections;
begin
 update public.mailbox_oauth_states s set claimed_at=now()from public.mailbox_connections c where s.state_hash=hash and s.claimed_at is null and s.expires_at>now()and c.id=s.connection_id and c.generation=s.generation and c.status='pending' returning s.* into state;
 if state.state_hash is null then raise exception 'OAuth state expired or used';end if;
 select * into connection from public.mailbox_connections where id=state.connection_id;
 return jsonb_build_object('id',connection.id,'userId',connection.user_id,'provider',connection.provider,'generation',state.generation,'verifier',state.sealed_verifier,'returnKind',state.return_kind);
end $$;
create function public.finish_mailbox_connection(connection uuid,expected_generation bigint,tokens text)returns void language plpgsql security definer set search_path='' as $$
begin
 update public.mailbox_connections set status='connected',connected_at=now()where id=connection and generation=expected_generation and status='pending';if not found then raise exception 'Connection changed';end if;
 insert into public.mailbox_credentials values(connection,tokens)on conflict(connection_id)do update set sealed_tokens=excluded.sealed_tokens;delete from public.mailbox_oauth_states where connection_id=connection;
end $$;
create function public.disconnect_mailbox(owner uuid,mail_provider text)returns text language plpgsql security definer set search_path='' as $$
declare connection uuid;tokens text;
begin
 update public.mailbox_connections set status='disconnected',generation=generation+1,scan_until=null where user_id=owner and provider=mail_provider returning id into connection;
 select sealed_tokens into tokens from public.mailbox_credentials where connection_id=connection;delete from public.mailbox_credentials where connection_id=connection;delete from public.mailbox_oauth_states where connection_id=connection;return tokens;
end $$;
create function public.claim_mailbox_scan(owner uuid,mail_provider text)returns jsonb language plpgsql security definer set search_path='' as $$
declare connection public.mailbox_connections;tokens text;
begin
 update public.mailbox_connections set scan_until=now()+interval '15 minutes'where user_id=owner and provider=mail_provider and status='connected'and(scan_until is null or scan_until<now())returning * into connection;
 if connection.id is null then raise exception 'Mailbox disconnected or scan in progress';end if;
 select sealed_tokens into tokens from public.mailbox_credentials where connection_id=connection.id;
 return jsonb_build_object('id',connection.id,'generation',connection.generation,'tokens',tokens);
end $$;
create function public.store_mailbox_tokens(connection uuid,expected_generation bigint,tokens text)returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.mailbox_connections where id=connection and generation=expected_generation and status='connected'for update;if not found then raise exception 'Connection changed';end if;
 update public.mailbox_credentials set sealed_tokens=tokens where connection_id=connection;
end $$;
revoke all on function public.begin_mailbox_connection(uuid,text,text,text,text),public.claim_mailbox_oauth(text),public.finish_mailbox_connection(uuid,bigint,text),public.disconnect_mailbox(uuid,text),public.claim_mailbox_scan(uuid,text),public.store_mailbox_tokens(uuid,bigint,text)from public,anon,authenticated;
grant execute on function public.begin_mailbox_connection(uuid,text,text,text,text),public.claim_mailbox_oauth(text),public.finish_mailbox_connection(uuid,bigint,text),public.disconnect_mailbox(uuid,text),public.claim_mailbox_scan(uuid,text),public.store_mailbox_tokens(uuid,bigint,text)to service_role;
