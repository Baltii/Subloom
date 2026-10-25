import { afterEach, describe, expect, it, vi } from "vitest";
import { planModeSql } from "../../scripts/plan-mode.mts";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});
describe("paid-plan switch", () => {
  it.each([undefined, "true", "unexpected"])(
    "retains restrictions for %s",
    async (value) => {
      vi.stubEnv("EXPO_PUBLIC_PRO_PLAN_ENABLED", value);
      vi.resetModules();
      const { requirePro } = await import("../../src/store/pro");
      expect(() => requirePro("guest")).toThrow(/Pro/);
    },
  );
  it("grants feature access offline without creating paid membership", async () => {
    vi.stubEnv("EXPO_PUBLIC_PRO_PLAN_ENABLED", "false");
    vi.resetModules();
    const { requirePro, workspaceHasPaidPro, usePro } =
      await import("../../src/store/pro");
    expect(() => requirePro("guest")).not.toThrow();
    expect(() => requirePro("account-workspace")).not.toThrow();
    expect(workspaceHasPaidPro("guest")).toBe(false);
    expect(usePro.getState().owner).toBeNull();
  });
  it("uses the same env flag for server enforcement and rejects invalid deployment values", () => {
    expect(planModeSql("false")).toMatchObject({ enabled: false });
    expect(planModeSql("false").sql).toContain("pro_plan_enabled=false");
    expect(planModeSql("true").sql).toContain("pro_plan_enabled=true");
    expect(planModeSql(undefined).enabled).toBe(true);
    expect(() => planModeSql("FALSE")).toThrow(/true or false/);
  });
});
