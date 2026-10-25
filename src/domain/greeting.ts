export type GreetingProfile = { owner: string; name: string | null };

/** Display-only metadata; never used for identity or entitlement decisions. */
export function profileDisplayName(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return null;
  const fields = metadata as Record<string, unknown>;
  for (const key of [
    "first_name",
    "given_name",
    "full_name",
    "name",
    "display_name",
  ]) {
    const value = fields[key];
    if (typeof value !== "string") continue;
    const name = value
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (name && Array.from(name).length <= 80) return name;
  }
  return null;
}

export function homeGreeting(
  identity: string,
  profile: GreetingProfile | null,
) {
  const name =
    identity !== "guest" && profile?.owner === identity ? profile.name : null;
  return name ? `Hi, ${name.trim().split(/\s+/)[0]} 👋` : "Hi! 👋";
}
