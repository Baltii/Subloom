// Only an explicit false disables paid restrictions. Missing configuration keeps
// the existing Free/Pro behavior, including in older build environments.
export const PRO_PLAN_ENABLED =
  process.env.EXPO_PUBLIC_PRO_PLAN_ENABLED !== "false";
