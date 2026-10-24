import { describe, expect, it } from "vitest";
import {
  catalog,
  searchServices,
  serviceFor,
  suggestServices,
} from "../../src/domain/catalog";
import { categories } from "../../src/domain/models";
import { serviceArtwork } from "../../src/assets/serviceArtwork";
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
  it("keeps multicolor SVG gradient references local to each brand", () => {
    expect(serviceArtwork.figma).toContain('fill="#0acf83"');
    const allIds = new Set<string>();
    for (const svg of Object.values(serviceArtwork)) {
      expect(svg).not.toMatch(/class=|<style/);
      const ids = new Set(
        [...svg.matchAll(/id="([^"]+)"/g)].map((match) => match[1]!),
      );
      for (const reference of svg.matchAll(/url\(#([^)]+)\)/g))
        expect(ids.has(reference[1]!)).toBe(true);
      for (const id of ids) {
        expect(allIds.has(id)).toBe(false);
        allIds.add(id);
      }
    }
  });
  it("bundles logos for every branded service and keeps unknown services safe", () => {
    const dedicatedGlyphs = new Set([
      "gym",
      "subloom-pro",
      ...Object.keys(serviceArtwork),
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
