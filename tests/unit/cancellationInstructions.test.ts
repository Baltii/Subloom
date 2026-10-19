import { describe, expect, it } from "vitest";
import { catalog } from "../../src/domain/catalog";
import {
  cancellationInstructions,
  generalCancellationInstructions,
  storeCancellationInstructions,
} from "../../src/domain/cancellationInstructions";

describe("cancellation instructions", () => {
  it("covers every named catalog service with a curated website and guidance", () => {
    for (const service of catalog.filter((row) => row.id !== "gym")) {
      const guide = cancellationInstructions(service.id);
      expect(guide, service.id).not.toBe(generalCancellationInstructions);
      expect(guide.steps.length, service.id).toBeGreaterThanOrEqual(3);
      for (const url of [guide.websiteUrl, guide.sourceUrl]) {
        expect(url, service.id).toBeTruthy();
        const parsed = new URL(url!);
        expect(parsed.protocol).toBe("https:");
        expect(parsed.username).toBe("");
        expect(parsed.password).toBe("");
      }
    }
  });

  it("does not turn custom names, unknown ids or object keys into provider links", () => {
    for (const id of [
      null,
      "unknown",
      "Netflix",
      "__proto__",
      "constructor",
      "https://example.com",
    ]) {
      expect(cancellationInstructions(id)).toBe(
        generalCancellationInstructions,
      );
      expect(cancellationInstructions(id).websiteUrl).toBeNull();
    }
    expect(cancellationInstructions("gym").websiteUrl).toBeNull();
    expect(cancellationInstructions("gym").note).toContain("specific club");
  });

  it("keeps store billing instructions separate from the selected service", () => {
    const netflix = cancellationInstructions("netflix");
    expect(netflix.steps.join(" ")).toContain("Finish Cancellation");
    expect(netflix.websiteUrl).toBe("https://www.netflix.com");
    expect(storeCancellationInstructions.Apple.manageUrl).toBe(
      "https://account.apple.com/account/manage/section/subscriptions",
    );
    expect(storeCancellationInstructions["Google Play"].manageUrl).toBe(
      "https://play.google.com/store/account/subscriptions",
    );
    expect(storeCancellationInstructions.Apple.steps.join(" ")).toContain(
      "purchase receipt",
    );
  });

  it("preserves guidance for materially different cancellation consequences", () => {
    expect(cancellationInstructions("adobe").note).toContain("fees");
    expect(cancellationInstructions("backblaze").note).toContain(
      "irreversibly",
    );
    expect(cancellationInstructions("digitalocean").note).toContain(
      "usage-based",
    );
    expect(cancellationInstructions("spotify").note).toContain("manager");
    expect(cancellationInstructions("icloud").note).toContain("storage");
  });
});
