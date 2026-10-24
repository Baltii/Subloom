import { describe, expect, it } from "vitest";
import {
  catalog,
  searchServices,
  serviceFor,
  suggestServices,
} from "../../src/domain/catalog";
import { categories } from "../../src/domain/models";
import { serviceLogos } from "../../src/assets/serviceLogos";

describe("service catalog", () => {
  it("preserves existing identifiers and has unique valid entries", () => {
    expect(serviceFor("spotify")?.name).toBe("Spotify");
    expect(serviceFor("microsoft")?.name).toBe("Microsoft 365");
    expect(catalog.length).toBeGreaterThan(60);
    expect(new Set(catalog.map((service) => service.id)).size).toBe(
      catalog.length,
    );
    for (const service of catalog)
      expect(categories).toContain(service.category);
  });
  it("searches names, aliases, categories and punctuation without case sensitivity", () => {
    expect(
      searchServices("apple tv").some((service) => service.id === "appletv"),
    ).toBe(true);
    expect(searchServices("COPILOT").map((service) => service.id)).toContain(
      "github",
    );
    expect(
      searchServices("one password").map((service) => service.id),
    ).toContain("1password");
    expect(searchServices("Paramount+").map((service) => service.id)).toContain(
      "paramountplus",
    );
    expect(searchServices("STÓRAGE").map((service) => service.id)).toContain(
      "dropbox",
    );
  });
  it("combines search terms with category filters and returns no false match", () => {
    expect(
      searchServices("apple", "Music").map((service) => service.id),
    ).toEqual(["applemusic"]);
    expect(searchServices("a service that does not exist")).toEqual([]);
    expect(searchServices(" ")).toHaveLength(catalog.length);
  });
  it("bundles logos for every added service and keeps unknown services safe", () => {
    const dedicatedGlyphs = new Set([
      "netflix",
      "spotify",
      "youtube",
      "icloud",
      "google",
      "chatgpt",
      "adobe",
      "microsoft",
      "amazon",
      "notion",
      "figma",
      "gym",
      "subloom-pro",
    ]);
    for (const service of catalog.filter(
      (service) => !dedicatedGlyphs.has(service.id),
    ))
      expect(serviceLogos[service.id]).toMatch(/^M/i);
    expect(serviceFor("subloom-pro")?.glyph).toBe("subloom");
    expect(serviceFor(null)).toBeUndefined();
    expect(serviceFor("https://example.com/untrusted.svg")).toBeUndefined();
    expect(
      Object.hasOwn(serviceLogos, "https://example.com/untrusted.svg"),
    ).toBe(false);
  });
});

describe("inline service name suggestions", () => {
  it("matches case-insensitive name prefixes and excludes substring/category matches", () => {
    expect(suggestServices("  SPÓT ").map((s) => s.id)).toContain("spotify");
    expect(suggestServices("flix")).toEqual([]);
    expect(suggestServices("entertainment")).toEqual([]);
  });
  it("matches known aliases, bounds results and keeps identifiers unique", () => {
    expect(suggestServices("one pass").map((s) => s.id)).toContain("1password");
    const matches = suggestServices("a");
    expect(matches.length).toBeLessThanOrEqual(6);
    expect(new Set(matches.map((s) => s.id)).size).toBe(matches.length);
  });
  it("keeps blank, punctuation-only and custom names free of suggestions", () => {
    for (const value of ["", "  ", "+++", "My local community subscription"])
      expect(suggestServices(value)).toEqual([]);
  });
});
