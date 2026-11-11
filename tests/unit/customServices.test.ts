import { expect, it } from "vitest";
import { defaultPreferences, preferencesSchema } from "../../src/domain/models";
import {
  personalServiceCatalog,
  rememberCustomService,
} from "../../src/domain/customServices";
import { searchServices, suggestServices } from "../../src/domain/catalog";
const id = "custom:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
it("loads older preferences without saved services and keeps custom data out of the shared catalogue", () => {
  const { customServices: _saved, ...legacy } = defaultPreferences();
  expect(preferencesSchema.parse(legacy).customServices).toEqual([]);
  const { services } = rememberCustomService(
    [],
    { name: "Local coding club", category: "Education" },
    id,
  );
  const own = personalServiceCatalog(services);
  expect(suggestServices("local", true, own).map((s) => s.id)).toEqual([id]);
  expect(
    searchServices("coding", "Education", true, own).map((s) => s.id),
  ).toEqual([id]);
  expect(searchServices("coding", "Music", true, own)).toEqual([]);
  expect(searchServices("Local coding club")).toEqual([]);
  expect(suggestServices("local")).toEqual([]);
});
it("uses an existing provider for a known brand instead of creating a duplicate template", () => {
  expect(
    rememberCustomService([], { name: " NETFLIX ", category: "Other" }, id),
  ).toEqual({ serviceId: "netflix", services: [] });
});
it("rejects URLs and forged provider IDs as custom service identifiers", () => {
  for (const invalid of [
    "netflix",
    "__proto__",
    "https://example.com/icon.svg",
  ])
    expect(() =>
      rememberCustomService(
        [],
        { name: "My service", category: "Other" },
        invalid,
      ),
    ).toThrow();
});
