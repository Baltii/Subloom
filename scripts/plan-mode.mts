export function planModeSql(value: string | undefined) {
  if (value !== undefined && value !== "true" && value !== "false")
    throw new Error("EXPO_PUBLIC_PRO_PLAN_ENABLED must be true or false.");
  const enabled = value !== "false";
  return {
    enabled,
    sql: `update private.plan_configuration set pro_plan_enabled=${enabled} where singleton; select public.pro_plan_enabled() as pro_plan_enabled;`,
  };
}
