import { describe, expect, it } from "vitest";
import { bottomTabLayout } from "../../src/theme/navigation";

describe("bottom navigation safe area", () => {
  it.each([0, 12, 24, 34, 48])(
    "keeps the touch/label area above a %i dp system inset",
    (inset) => {
      const layout = bottomTabLayout(inset);
      expect(layout.paddingBottom).toBeGreaterThanOrEqual(inset);
      expect(layout.height - layout.paddingBottom).toBe(60);
      expect(layout.paddingBottom).toBeGreaterThanOrEqual(12);
    },
  );
  it("adapts when system navigation changes without shrinking the interactive area", () => {
    const gesture = bottomTabLayout(24);
    const buttons = bottomTabLayout(48);
    expect(buttons.height - gesture.height).toBe(24);
    expect(buttons.paddingBottom - gesture.paddingBottom).toBe(24);
  });
});
