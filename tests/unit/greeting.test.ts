import { describe, expect, it } from "vitest";
import { homeGreeting, profileDisplayName } from "../../src/domain/greeting";

describe("Home greeting", () => {
  it("reads available display names and preserves international names", () => {
    expect(
      profileDisplayName({ full_name: "  أحمد   Baltii \n", name: "Other" }),
    ).toBe("أحمد Baltii");
    expect(profileDisplayName({ full_name: 42, first_name: "Anaïs" })).toBe(
      "Anaïs",
    );
    expect(profileDisplayName({ given_name: "李" })).toBe("李");
  });
  it("ignores absent, malformed and oversized profile metadata", () => {
    for (const value of [
      undefined,
      null,
      [],
      "Name",
      {},
      { full_name: "  " },
      { name: "a".repeat(81) },
    ])
      expect(profileDisplayName(value)).toBeNull();
  });
  it("never displays another account's name while changing workspaces or signing out", () => {
    const profile = { owner: "alice", name: "Alice" };
    expect(homeGreeting("alice", profile)).toBe("Hi!, Alice 👋");
    expect(homeGreeting("bob", profile)).toBe("Hi! 👋");
    expect(homeGreeting("guest", profile)).toBe("Hi! 👋");
    expect(homeGreeting("alice", null)).toBe("Hi! 👋");
    expect(homeGreeting("alice", { owner: "alice", name: null })).toBe(
      "Hi! 👋",
    );
  });
});
