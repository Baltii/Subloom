import { beforeEach, expect, it, vi } from "vitest";
import { emptySnapshot } from "../../src/domain/models";
import { emptyPro, usePro } from "../../src/store/pro";
import { shareSubscriptionCsv } from "../../src/services/subscriptionCsv";
import { userA, userB } from "../fixtures";
const mocks = vi.hoisted(() => ({ identity: "guest", share: vi.fn() }));
vi.mock("../../src/store/app", () => ({
  useApp: {
    getState: () => ({ identity: mocks.identity, data: emptySnapshot() }),
  },
}));
vi.mock("../../src/services/files", () => ({ shareText: mocks.share }));
beforeEach(() => {
  usePro.setState(emptyPro);
  mocks.identity = "guest";
  mocks.share.mockReset();
});
it("does not open a CSV share/download without current Pro access", async () => {
  await expect(shareSubscriptionCsv("guest")).rejects.toThrow(/Pro/);
  expect(mocks.share).not.toHaveBeenCalled();
  usePro.setState({
    ...emptyPro,
    workspace: "guest",
    owner: userA,
    ready: true,
    offlineUntil: Date.now() - 1,
  });
  await expect(shareSubscriptionCsv("guest")).rejects.toThrow(/Pro/);
  expect(mocks.share).not.toHaveBeenCalled();
});
it("exports CSV for the entitled workspace and rejects a switched account", async () => {
  mocks.identity = userA;
  usePro.setState({
    ...emptyPro,
    workspace: userA,
    owner: userA,
    ready: true,
    offlineUntil: Date.now() + 60000,
  });
  await shareSubscriptionCsv(userA);
  expect(mocks.share).toHaveBeenCalledWith(
    expect.any(String),
    "subloom-subscriptions.csv",
    "text/csv",
  );
  mocks.share.mockClear();
  mocks.identity = userB;
  await expect(shareSubscriptionCsv(userA)).rejects.toThrow(/account changed/);
  await expect(shareSubscriptionCsv(userB)).rejects.toThrow(/Pro/);
  expect(mocks.share).not.toHaveBeenCalled();
});
