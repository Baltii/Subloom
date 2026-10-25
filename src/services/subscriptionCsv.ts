import { exportCsv } from "../domain/csv";
import { useApp } from "../store/app";
import { requirePro } from "../store/pro";
import { shareText } from "./files";

export async function shareSubscriptionCsv(identity: string) {
  const state = useApp.getState();
  if (state.identity !== identity)
    throw new Error("Your account changed. Open the CSV tool again.");
  requirePro(identity);
  await shareText(
    exportCsv(state.data.subscriptions),
    "subloom-subscriptions.csv",
    "text/csv",
  );
}
