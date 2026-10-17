import { describe, expect, it } from "vitest";
import { macSigningPlan } from "../../scripts/macos-signing.mts";
describe("Mac widget signing configuration", () => {
  it("keeps unsigned builds free of an invented App Group entitlement", () => {
    expect(macSigningPlan({})).toEqual({
      identity: "-",
      team: "",
      group: null,
    });
  });
  it("requires a consistent team-prefixed shared group and real signing configuration", () => {
    expect(
      macSigningPlan({
        MACOS_SIGN_IDENTITY: "identity",
        MACOS_TEAM_ID: "ABC1234567",
      }).group,
    ).toBe("ABC1234567.com.subloom.widgets");
    for (const env of [
      { MACOS_TEAM_ID: "ABC1234567" },
      { MACOS_SIGN_IDENTITY: "identity" },
      { MACOS_WIDGET_APP_GROUP: "group.fake" },
      { MACOS_SIGN_IDENTITY: "identity", MACOS_TEAM_ID: "wrong" },
      {
        MACOS_SIGN_IDENTITY: "identity",
        MACOS_TEAM_ID: "ABC1234567",
        MACOS_WIDGET_APP_GROUP: "OTHER12345.widgets",
      },
    ])
      expect(() => macSigningPlan(env)).toThrow();
  });
});
