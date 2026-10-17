export function macSigningPlan(env: Record<string, string | undefined>) {
  const identity = env.MACOS_SIGN_IDENTITY || "-";
  const team = env.MACOS_TEAM_ID || "";
  if ((identity !== "-") !== Boolean(team))
    throw new Error(
      "Set MACOS_SIGN_IDENTITY and MACOS_TEAM_ID together for a signed widget build.",
    );
  if (team && !/^[A-Z0-9]{10}$/.test(team))
    throw new Error(
      "MACOS_TEAM_ID must be your ten-character Apple Developer Team ID.",
    );
  const group = team
    ? env.MACOS_WIDGET_APP_GROUP || `${team}.com.subloom.widgets`
    : null;
  if (env.MACOS_WIDGET_APP_GROUP && !team)
    throw new Error(
      "A widget App Group requires a signed Mac build and Team ID.",
    );
  if (
    group &&
    (!group.startsWith(`${team}.`) ||
      !/^[A-Z0-9]{10}\.[a-zA-Z0-9.-]+$/.test(group))
  )
    throw new Error(
      "Use a macOS App Group prefixed with your Apple Developer Team ID.",
    );
  return { identity, team, group };
}
