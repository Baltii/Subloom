-- Team access requires both membership and a signed SAML provider claim.
alter table public.workspaces add column sso_provider_id uuid;
alter table public.workspaces add constraint workspace_sso_kind check((kind='family' and sso_provider_id is null)or(kind='team' and sso_provider_id is not null));
create function public.current_sso_provider()returns uuid language sql stable set search_path='' as $$
 select case when count(distinct entry->>'provider')=1 then min(entry->>'provider')::uuid else null end
 from jsonb_array_elements(case when jsonb_typeof(auth.jwt()->'amr')='array' then auth.jwt()->'amr' else '[]'::jsonb end)entry
 where entry->>'method'='sso/saml' and entry->>'provider' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;
create function public.workspace_provider_allowed(scope uuid)returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.workspaces where id=scope and(kind='family' or sso_provider_id=public.current_sso_provider()));
$$;
create or replace function public.workspace_member(scope uuid)returns boolean language sql stable security definer set search_path='' as $$
 select public.workspace_provider_allowed(scope) and exists(select 1 from public.workspace_members where workspace_id=scope and user_id=auth.uid());
$$;
revoke all on function public.current_sso_provider(),public.workspace_provider_allowed(uuid) from public,anon;
grant execute on function public.current_sso_provider(),public.workspace_provider_allowed(uuid) to authenticated;
create function public.create_team_workspace(workspace_name text,member_name text)returns uuid language plpgsql security definer set search_path='' as $$
declare provider uuid=public.current_sso_provider();scope uuid;
begin
 if auth.uid()is null or provider is null then raise exception 'Sign in with your organization SSO to create a team';end if;
 if(select count(*)from public.workspaces where owner_id=auth.uid())>=20 then raise exception 'Workspace limit reached';end if;
 insert into public.workspaces(owner_id,name,kind,sso_provider_id)values(auth.uid(),trim(workspace_name),'team',provider)returning id into scope;
 insert into public.workspace_members values(scope,auth.uid(),trim(member_name));return scope;
end $$;
revoke all on function public.create_team_workspace(text,text)from public,anon;grant execute on function public.create_team_workspace(text,text)to authenticated;
-- Guard every SECURITY DEFINER mutation, which otherwise bypasses RLS.
alter function public.invite_workspace(uuid)rename to invite_workspace_internal;
revoke all on function public.invite_workspace_internal(uuid)from public,anon,authenticated;
create function public.invite_workspace(scope uuid)returns text language plpgsql security definer set search_path='' as $$
begin
 if not public.workspace_member(scope)then raise exception 'Workspace membership and organization SSO are required';end if;
 return public.invite_workspace_internal(scope);
end $$;
revoke all on function public.invite_workspace(uuid)from public,anon;grant execute on function public.invite_workspace(uuid)to authenticated;
alter function public.save_workspace_subscription(uuid,jsonb,uuid,jsonb,integer)rename to save_workspace_subscription_internal;
revoke all on function public.save_workspace_subscription_internal(uuid,jsonb,uuid,jsonb,integer)from public,anon,authenticated;
create function public.save_workspace_subscription(scope uuid,subscription_data jsonb,billing_owner uuid,cost_shares jsonb,expected_version integer)returns integer language plpgsql security definer set search_path='' as $$
begin
 if not public.workspace_member(scope)then raise exception 'Workspace membership and organization SSO are required';end if;
 return public.save_workspace_subscription_internal(scope,subscription_data,billing_owner,cost_shares,expected_version);
end $$;
revoke all on function public.save_workspace_subscription(uuid,jsonb,uuid,jsonb,integer)from public,anon;grant execute on function public.save_workspace_subscription(uuid,jsonb,uuid,jsonb,integer)to authenticated;
alter function public.manage_workspace(uuid,text,uuid,integer)rename to manage_workspace_internal;
revoke all on function public.manage_workspace_internal(uuid,text,uuid,integer)from public,anon,authenticated;
create function public.manage_workspace(scope uuid,action text,target uuid default null,expected_version integer default null)returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.workspace_member(scope)then raise exception 'Workspace membership and organization SSO are required';end if;
 perform public.manage_workspace_internal(scope,action,target,expected_version);
end $$;
revoke all on function public.manage_workspace(uuid,text,uuid,integer)from public,anon;grant execute on function public.manage_workspace(uuid,text,uuid,integer)to authenticated;
alter function public.join_workspace(text,text)rename to join_workspace_internal;
revoke all on function public.join_workspace_internal(text,text)from public,anon,authenticated;
create function public.join_workspace(invite_token text,member_name text)returns uuid language plpgsql security definer set search_path='' as $$
declare scope uuid;
begin
 if auth.uid()is null or length(invite_token)>200 then raise exception 'Sign in to join';end if;
 select workspace_id into scope from public.workspace_invites where token_hash=encode(sha256(convert_to(invite_token,'UTF8')),'hex');
 if scope is not null and not public.workspace_provider_allowed(scope)then raise exception 'Sign in with the organization SSO for this invitation';end if;
 return public.join_workspace_internal(invite_token,member_name);
end $$;
revoke all on function public.join_workspace(text,text)from public,anon;grant execute on function public.join_workspace(text,text)to authenticated;
