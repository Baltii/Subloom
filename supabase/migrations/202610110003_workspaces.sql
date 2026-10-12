create table public.workspaces(id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,name text not null check(length(trim(name)) between 1 and 80),kind text not null default 'family' check(kind in ('family','team')),created_at timestamptz not null default now());
create table public.workspace_members(workspace_id uuid not null references public.workspaces(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,display_name text not null check(length(trim(display_name)) between 1 and 80),primary key(workspace_id,user_id));
create table public.workspace_invites(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,token_hash text not null unique,expires_at timestamptz not null default now()+interval '48 hours',used_at timestamptz,revoked_at timestamptz);
create table public.workspace_subscriptions(like public.subscriptions including defaults including generated including constraints);
alter table public.workspace_subscriptions add primary key(id),add column workspace_id uuid not null references public.workspaces(id) on delete cascade,add column managed_by uuid not null,add column shares jsonb not null check(jsonb_typeof(shares)='array' and octet_length(shares::text)<=16384),add foreign key(workspace_id,managed_by) references public.workspace_members(workspace_id,user_id),add foreign key(user_id) references auth.users(id) on delete cascade;
create index workspace_subscriptions_scope on public.workspace_subscriptions(workspace_id);
create index workspace_owner on public.workspaces(owner_id);
create index workspace_members_user on public.workspace_members(user_id,workspace_id);
create index workspace_invites_scope on public.workspace_invites(workspace_id);
create function public.workspace_member(scope uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.workspace_members where workspace_id=scope and user_id=auth.uid())$$;
revoke all on function public.workspace_member(uuid) from public,anon;grant execute on function public.workspace_member(uuid) to authenticated;
alter table public.workspaces enable row level security;alter table public.workspace_members enable row level security;alter table public.workspace_invites enable row level security;alter table public.workspace_subscriptions enable row level security;
revoke all on public.workspaces,public.workspace_members,public.workspace_invites,public.workspace_subscriptions from anon,authenticated;
grant select on public.workspaces,public.workspace_members,public.workspace_subscriptions to authenticated;
create policy workspace_visible on public.workspaces for select to authenticated using(public.workspace_member(id));
create policy members_visible on public.workspace_members for select to authenticated using(public.workspace_member(workspace_id));
create policy subscriptions_visible on public.workspace_subscriptions for select to authenticated using(public.workspace_member(workspace_id));
create function public.create_workspace(workspace_name text,member_name text,workspace_kind text default 'family') returns uuid language plpgsql security definer set search_path='' as $$
declare scope uuid;
begin
 if auth.uid() is null or workspace_kind<>'family' then raise exception 'Sign in to create a family workspace';end if;
 if (select count(*) from public.workspaces where owner_id=auth.uid())>=20 then raise exception 'Workspace limit reached';end if;
 insert into public.workspaces(owner_id,name,kind)values(auth.uid(),trim(workspace_name),workspace_kind)returning id into scope;
 insert into public.workspace_members values(scope,auth.uid(),trim(member_name));return scope;
end $$;
create function public.invite_workspace(scope uuid) returns text language plpgsql security definer set search_path='' as $$
declare token text;
begin
 perform 1 from public.workspaces where id=scope and owner_id=auth.uid() for update;if not found then raise exception 'Owner access required';end if;
 if (select count(*) from public.workspace_members where workspace_id=scope)>=50 or (select count(*) from public.workspace_invites where workspace_id=scope and used_at is null and revoked_at is null and expires_at>now())>=20 then raise exception 'Invite limit reached';end if;
 token=gen_random_uuid()::text||gen_random_uuid()::text;
 insert into public.workspace_invites(workspace_id,token_hash)values(scope,encode(sha256(convert_to(token,'UTF8')),'hex'));return token;
end $$;
create function public.join_workspace(invite_token text,member_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.workspace_invites;scope uuid;
begin
 if auth.uid() is null or length(invite_token)>200 then raise exception 'Sign in to join';end if;
 if not public.take_rate_limit('workspace-join:'||auth.uid()::text,20,3600,auth.uid()) then raise exception 'Too many join attempts';end if;
 select * into invitation from public.workspace_invites where token_hash=encode(sha256(convert_to(invite_token,'UTF8')),'hex') and used_at is null and revoked_at is null and expires_at>now() for update;
 if not found then raise exception 'Invite expired or unavailable';end if;scope=invitation.workspace_id;
 perform 1 from public.workspaces where id=scope for update;
 if (select count(*) from public.workspace_members where workspace_id=scope)>=50 then raise exception 'Workspace is full';end if;
 insert into public.workspace_members values(scope,auth.uid(),trim(member_name)) on conflict do nothing;
 update public.workspace_invites set used_at=now()where id=invitation.id;return scope;
end $$;
create function public.save_workspace_subscription(scope uuid,subscription_data jsonb,billing_owner uuid,cost_shares jsonb,expected_version integer) returns integer language plpgsql security definer set search_path='' as $$
declare owner uuid;item uuid;current_version integer;next_version integer;s jsonb;
begin
 select owner_id into owner from public.workspaces where id=scope for update;
 if owner is null or owner<>auth.uid()then raise exception 'Owner access required';end if;
 if expected_version is null or expected_version<0 or jsonb_typeof(cost_shares)<>'array' or jsonb_array_length(cost_shares) not between 1 and 50 then raise exception 'Invalid shared subscription';end if;
 item=(subscription_data->>'id')::uuid;
 select version into current_version from public.workspace_subscriptions where id=item and workspace_id=scope;
 if coalesce(current_version,0)<>expected_version then raise exception 'Shared subscription conflict';end if;next_version=expected_version+1;
 if not exists(select 1 from public.workspace_members where workspace_id=scope and user_id=billing_owner)then raise exception 'Billing owner is not a member';end if;
 if exists(select 1 from jsonb_array_elements(cost_shares) r where jsonb_typeof(r->'amountMinor')<>'number' or (r->>'amountMinor')!~'^[0-9]+$' or not exists(select 1 from public.workspace_members m where m.workspace_id=scope and m.user_id=(r->>'userId')::uuid)) or (select count(distinct r->>'userId') from jsonb_array_elements(cost_shares)r)<>jsonb_array_length(cost_shares) or (select sum((r->>'amountMinor')::bigint) from jsonb_array_elements(cost_shares)r)<>(subscription_data->>'amountMinor')::bigint then raise exception 'Shares must sum to the price and belong to members';end if;
 s=subscription_data||jsonb_build_object('userId',owner,'version',next_version,'updatedAt',to_char(clock_timestamp()at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
 if not public.validate_subscription(s) then raise exception 'Invalid subscription';end if;
 if current_version is null then insert into public.workspace_subscriptions(id,user_id,data,version,workspace_id,managed_by,shares)values(item,owner,s,next_version,scope,billing_owner,cost_shares);
 else update public.workspace_subscriptions set data=s,version=next_version,managed_by=billing_owner,shares=cost_shares,updated_at=now()where id=item and workspace_id=scope;end if;return next_version;
end $$;
create function public.manage_workspace(scope uuid,action text,target uuid default null,expected_version integer default null) returns void language plpgsql security definer set search_path='' as $$
declare owner uuid;
begin
 select owner_id into owner from public.workspaces where id=scope for update;
 if owner is null or auth.uid() is null then raise exception 'Workspace unavailable';end if;
 if action='leave' then
   if owner=auth.uid()then raise exception 'The owner must delete the workspace or keep membership';end if;target=auth.uid();
 elsif owner<>auth.uid()then raise exception 'Owner access required';end if;
 if action in ('remove_member','leave')then
  if target=owner then raise exception 'Cannot remove the owner';end if;
  if exists(select 1 from public.workspace_subscriptions where workspace_id=scope and (managed_by=target or shares @>jsonb_build_array(jsonb_build_object('userId',target::text))))then raise exception 'Reassign billing ownership and remove cost shares before removing this member';end if;
  delete from public.workspace_members where workspace_id=scope and user_id=target;
 elsif action='revoke_invites'then update public.workspace_invites set revoked_at=now()where workspace_id=scope and used_at is null;
 elsif action='delete_subscription'then
  delete from public.workspace_subscriptions where workspace_id=scope and id=target and version=expected_version;if not found then raise exception 'Shared subscription conflict';end if;
 elsif action='delete_workspace'then delete from public.workspaces where id=scope;
 else raise exception 'Unknown workspace action';end if;
end $$;
revoke all on function public.create_workspace(text,text,text),public.invite_workspace(uuid),public.join_workspace(text,text),public.save_workspace_subscription(uuid,jsonb,uuid,jsonb,integer),public.manage_workspace(uuid,text,uuid,integer) from public,anon;
grant execute on function public.create_workspace(text,text,text),public.invite_workspace(uuid),public.join_workspace(text,text),public.save_workspace_subscription(uuid,jsonb,uuid,jsonb,integer),public.manage_workspace(uuid,text,uuid,integer) to authenticated;

-- Account deletion must not be blocked by a member's billing assignment.
create function public.reassign_departing_workspace_member() returns trigger language plpgsql security definer set search_path='' as $$
declare owner uuid;row public.workspace_subscriptions;remaining jsonb;departing bigint;owner_share bigint;
begin
 select owner_id into owner from public.workspaces where id=old.workspace_id;
 if owner is null or owner=old.user_id then return old;end if;
 for row in select * from public.workspace_subscriptions where workspace_id=old.workspace_id and (managed_by=old.user_id or shares @>jsonb_build_array(jsonb_build_object('userId',old.user_id::text))) for update loop
  select coalesce(sum((r->>'amountMinor')::bigint),0)into departing from jsonb_array_elements(row.shares)r where r->>'userId'=old.user_id::text;
  select coalesce(sum((r->>'amountMinor')::bigint),0)into owner_share from jsonb_array_elements(row.shares)r where r->>'userId'=owner::text;
  select coalesce(jsonb_agg(r),'[]'::jsonb)into remaining from jsonb_array_elements(row.shares)r where r->>'userId' not in(old.user_id::text,owner::text);
  update public.workspace_subscriptions set shares=remaining||jsonb_build_array(jsonb_build_object('userId',owner,'amountMinor',owner_share+departing)),managed_by=case when managed_by=old.user_id then owner else managed_by end,version=version+1,data=data||jsonb_build_object('version',version+1),updated_at=now()where id=row.id;
 end loop;return old;
end $$;
revoke all on function public.reassign_departing_workspace_member()from public,anon,authenticated;
create trigger reassign_departing_member before delete on public.workspace_members for each row execute function public.reassign_departing_workspace_member();
