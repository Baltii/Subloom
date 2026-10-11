import { z } from "zod";
export function organizationDomain(input: string) {
  const value = input.trim().toLowerCase();
  if (
    value.length > 253 ||
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(value)
  )
    throw new Error("Enter your organization domain, such as company.com.");
  return value;
}
// For UI hints only. Authorization always uses the database's verified JWT.
export function ssoProvider(claims: unknown): string | null {
  const parsed = z
    .object({
      amr: z
        .array(
          z.object({ method: z.string(), provider: z.string().optional() }),
        )
        .optional(),
    })
    .safeParse(claims);
  if (!parsed.success) return null;
  const providers = [
    ...new Set(
      (parsed.data.amr || [])
        .filter(
          (entry) =>
            entry.method === "sso/saml" &&
            z.string().uuid().safeParse(entry.provider).success,
        )
        .map((entry) => entry.provider!),
    ),
  ];
  return providers.length === 1 ? providers[0]! : null;
}
