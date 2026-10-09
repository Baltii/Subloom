import { defaultPreferences, type Subscription } from "../src/domain/models";
export const userA = "11111111-1111-4111-8111-111111111111";
export const userB = "22222222-2222-4222-8222-222222222222";
export function subscription(
  overrides: Partial<Subscription> = {},
): Subscription {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    userId: userA,
    serviceId: "spotify",
    name: "Spotify",
    category: "Music",
    amountMinor: 1099,
    currency: "USD",
    interval: "monthly",
    intervalCount: 1,
    customUnit: "day",
    startDate: "2026-01-31",
    nextRenewal: "2026-01-31",
    anchorDay: 31,
    status: "active",
    trialEnd: null,
    canceledAt: null,
    paidThrough: null,
    paymentMethod: "",
    notes: "",
    source: "manual",
    reminders: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    version: 1,
    ...overrides,
  };
}
export function preferences() {
  return { ...defaultPreferences(), timezone: "UTC", emailEnabled: true };
}
