-- The app uses its build flag; only backend billing needs to read this RPC.
-- Invoker permissions avoid exposing a privileged public function.
grant usage on schema private to service_role;
grant select on private.plan_configuration to service_role;
create or replace function public.pro_plan_enabled() returns boolean
language sql stable security invoker set search_path='' as $$
  select coalesce((select pro_plan_enabled from private.plan_configuration where singleton), true);
$$;
revoke all on function public.pro_plan_enabled() from public, anon, authenticated;
grant execute on function public.pro_plan_enabled() to service_role;
