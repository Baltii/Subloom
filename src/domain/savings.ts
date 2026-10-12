import type { Subscription } from "./models";
import { recurringTotals } from "./money";
export function simulateSavings(
  subscriptions: Subscription[],
  selectedIds: string[],
) {
  const selected = new Set(selectedIds);
  const eligible = subscriptions.filter(
    (s) => s.status === "active" || s.status === "trial",
  );
  const savings = recurringTotals(eligible.filter((s) => selected.has(s.id)));
  const remaining = recurringTotals(
    eligible.filter((s) => !selected.has(s.id)),
  );
  return {
    savings,
    remaining,
    count: eligible.filter((s) => selected.has(s.id)).length,
  };
}
