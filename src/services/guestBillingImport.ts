import { emptyPaymentProfile, paymentProfileSchema } from "../domain/payments";
import { mergeGuestBillingMethods } from "../domain/billingMethods";
import { readSetting, writeSetting } from "./featureSettings";
import { loadSnapshot } from "./storage";
import { canAddSubscriptions, FREE_SUBSCRIPTIONS } from "../domain/pro";
import { workspaceHasPro } from "../store/pro";
import { importGuestData, useApp } from "../store/app";

// Save metadata first, so a failed settings write cannot import dangling assignments.
// A failed subscription write can safely be retried: method IDs are preserved and deduplicated.
export async function importGuestBillingWorkspace() {
  const identity = useApp.getState().identity;
  const guard = () => {
    if (
      identity === "guest" ||
      identity !== useApp.getState().identity ||
      !useApp.getState().hydrated
    )
      throw new Error(
        "Your account changed. Reopen the account screen before importing.",
      );
  };
  guard();
  const snapshot = await loadSnapshot("guest");
  if (snapshot.demo)
    throw new Error(
      "Leave the sample workspace before importing your own data.",
    );
  const currentIds = useApp.getState().data.subscriptions.map((s) => s.id);
  const nextIds = [
    ...new Set([...currentIds, ...snapshot.subscriptions.map((s) => s.id)]),
  ];
  if (!canAddSubscriptions(currentIds, nextIds, workspaceHasPro(identity)))
    throw new Error(
      `Free includes up to ${FREE_SUBSCRIPTIONS} subscriptions. Open Subloom Pro before importing more; your local copy is preserved.`,
    );
  const guest = await readSetting(
    "guest",
    "payment_sources",
    paymentProfileSchema,
    emptyPaymentProfile,
  );
  guard();
  if (guest.value.sources.length) {
    const account = await readSetting(
      identity,
      "payment_sources",
      paymentProfileSchema,
      emptyPaymentProfile,
    );
    guard();
    const existing = new Set(
      useApp.getState().data.subscriptions.map((item) => item.id),
    );
    const importing = new Set(
      snapshot.subscriptions
        .filter((item) => !existing.has(item.id))
        .map((item) => item.id),
    );
    const merged = mergeGuestBillingMethods(
      account.value,
      guest.value,
      importing,
    );
    if (JSON.stringify(merged) !== JSON.stringify(account.value))
      await writeSetting(
        identity,
        "payment_sources",
        paymentProfileSchema,
        merged,
        account.version,
      );
    guard();
  }
  await importGuestData(identity);
}
