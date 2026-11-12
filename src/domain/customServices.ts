import { catalog, type Service } from "./catalog";
import { customServiceSchema, type CustomService } from "./models";
import { categoryAppearance } from "./categories";

export function serviceNameKey(name: string) {
  return name
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ");
}
export function savedServiceForName(
  name: string,
  saved: readonly CustomService[],
) {
  const key = serviceNameKey(name);
  return (
    catalog.find((service) => serviceNameKey(service.name) === key) ??
    saved.find((service) => serviceNameKey(service.name) === key)
  );
}
export function rememberCustomService(
  saved: readonly CustomService[],
  input: Pick<CustomService, "name" | "category">,
  id: string,
) {
  const existing = savedServiceForName(input.name, saved);
  if (existing) return { serviceId: existing.id, services: saved };
  if (saved.length >= 200)
    throw new Error("Your saved service list is full (200 services).");
  const service = customServiceSchema.parse({
    category: input.category,
    name: input.name.trim(),
    id,
  });
  return { serviceId: service.id, services: [...saved, service] };
}
export function personalServiceCatalog(
  saved: readonly CustomService[],
): Service[] {
  return saved.map((service) => ({
    ...service,
    color: categoryAppearance(service.category).color,
    background: categoryAppearance(service.category).background,
    glyph: "",
    managementUrl: null,
    custom: true,
  }));
}
