import { describe, expect, it } from "vitest";
import {
  feedbackDraftSchema,
  feedbackRequestSchema,
  feedbackTitle,
} from "../../src/domain/feedback";

const draft = {
  kind: "idea",
  title: "Calendar search",
  message: "Please add search to the calendar view.",
  replyEmail: null,
};
describe("feedback validation", () => {
  it("creates a readable inbox title without another form field", () => {
    expect(feedbackTitle("  A calendar\n  with search  ")).toBe(
      "A calendar with search",
    );
    const title = feedbackTitle("💚".repeat(70));
    expect(Array.from(title)).toHaveLength(60);
    expect(feedbackDraftSchema.safeParse({ ...draft, title }).success).toBe(
      true,
    );
  });
  it("accepts private feedback without email and trims user input", () => {
    expect(
      feedbackDraftSchema.parse({
        ...draft,
        title: "  Calendar search  ",
        replyEmail: "  person@example.com  ",
      }),
    ).toMatchObject({
      title: "Calendar search",
      replyEmail: "person@example.com",
    });
    expect(feedbackDraftSchema.parse(draft).replyEmail).toBeNull();
  });
  it("rejects empty and oversized content, invalid email and unknown fields", () => {
    for (const patch of [
      { title: "  " },
      { title: "a".repeat(121) },
      { message: "tiny" },
      { message: "a".repeat(4001) },
      { replyEmail: "not-an-email" },
      { kind: "billing" },
      { userId: "forged" },
      { status: "planned" },
    ]) {
      expect(
        feedbackDraftSchema.safeParse({ ...draft, ...patch }).success,
      ).toBe(false);
    }
  });
  it("requires a valid request id and bounded platform/version metadata", () => {
    const request = {
      ...draft,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      platform: "web",
      appVersion: "1.8.0",
    };
    expect(feedbackRequestSchema.safeParse(request).success).toBe(true);
    for (const patch of [
      { id: "bad" },
      { platform: "unknown" },
      { appVersion: "a".repeat(41) },
      { subscriptions: [] },
    ])
      expect(
        feedbackRequestSchema.safeParse({ ...request, ...patch }).success,
      ).toBe(false);
  });
});
