create table public.feature_settings (
 user_id uuid not null references auth.users(id) on delete cascade,
 key text not null check (key in ('budgets','cancellation')),
 data jsonb not null check (jsonb_typeof(data) in ('array','object') and octet_length(data::text) <= 131072),
 version bigint not null default 1 check (version > 0),
 primary key (user_id,key)
);
alter table public.feature_settings enable row level security;
revoke all on public.feature_settings from anon,authenticated;
grant select on public.feature_settings to authenticated;
create policy owned_feature_settings on public.feature_settings for select to authenticated using (user_id=(select auth.uid()));
create function public.save_feature_setting(setting_key text, setting_data jsonb, expected_version bigint) returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint;
begin
 if auth.uid() is null or expected_version is null or expected_version < 0 then raise exception 'Sign in and supply a version'; end if;
 if expected_version=0 then
   insert into public.feature_settings(user_id,key,data) values(auth.uid(),setting_key,setting_data) on conflict do nothing returning version into result;
 else
   update public.feature_settings set data=setting_data,version=version+1 where user_id=auth.uid() and key=setting_key and version=expected_version returning version into result;
 end if;
 if result is null then raise exception 'Settings conflict'; end if;
 return result;
end $$;
revoke all on function public.save_feature_setting(text,jsonb,bigint) from public,anon;
grant execute on function public.save_feature_setting(text,jsonb,bigint) to authenticated;
