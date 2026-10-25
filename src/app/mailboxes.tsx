import { ThemedSwitch } from "../components/ui/ThemedSwitch";
import { useState } from "react";
import { View } from "react-native";
import {
  openAuthBrowser,
  usesNativeAuthBrowser,
  authBrowserRedirect,
} from "../services/authBrowser";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { accountClient } from "../services/supabase";
import { useApp, readableError } from "../store/app";
import { syncNow } from "../services/sync";
import {
  Button,
  Card,
  Confirm,
  Heading,
  Label,
  Page,
} from "../components/ui/Primitives";
const connectionSchema = z.object({
  id: z.string().uuid(),
  provider: z.enum(["gmail", "outlook"]),
  status: z.enum(["pending", "connected", "disconnected"]),
  last_scanned_at: z.string().nullable(),
});
function Mailboxes({ identity }: { identity: string }) {
  const demo = useApp((s) => s.data.demo);
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [disconnect, setDisconnect] = useState<"gmail" | "outlook" | null>(null);
  async function invoke(body: Record<string, unknown>) {
    const client = await accountClient(identity);
    const { data, error } = await client.functions.invoke("mailbox-connect", {
      body,
    });
    if (error || data?.error)
      throw new Error(
        "Mailbox action failed. Check the connection, provider credentials and consent, then retry.",
      );
    return data;
  }
  const query = useQuery({
    queryKey: ["mailboxes", identity],
    enabled: identity !== "guest" && !demo,
    queryFn: async () =>
      z
        .array(connectionSchema)
        .parse((await invoke({ action: "status" })).connections),
  });
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await query.refetch();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title="Mailbox receipt discovery"
      subtitle="Connect with read-only consent, scan recent receipts, then review every detection."
      back
    >
      <View style={{ gap: 18 }}>
        {identity === "guest" || demo ? (
          <Label>
            Sign in with your own verified account to connect a mailbox.
          </Label>
        ) : (
          <>
            <Card>
              <View style={{ gap: 14 }}>
                <Label>
                  Google and Microsoft grant access to read mailbox messages.
                  Subloom requests read-only access, scans up to 25 matching
                  messages from the last 30 days when you press Scan, and keeps
                  extracted receipt candidates, message identifiers and sender
                  hashes. Attachments are not downloaded. Subscription creation
                  always needs your review.
                </Label>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <Label style={{ flex: 1 }}>
                    I consent to read-only mailbox access for receipt discovery
                  </Label>
                  <ThemedSwitch
                    accessibilityLabel="Consent to read-only mailbox access"
                    value={consent}
                    onValueChange={setConsent}
                  />
                </View>
              </View>
            </Card>
            <Button
              variant="secondary"
              loading={query.isFetching}
              onPress={() => {
                void query.refetch();
              }}
            >
              Refresh connections
            </Button>
            {query.error ? (
              <Label accessibilityRole="alert">{query.error.message}</Label>
            ) : null}
            {(["gmail", "outlook"] as const).map((provider) => {
              const connection = query.data?.find(
                (c) => c.provider === provider,
              );
              return (
                <Card key={provider}>
                  <View style={{ gap: 14 }}>
                    <Heading size={20}>
                      {provider === "gmail" ? "Gmail" : "Outlook"}
                    </Heading>
                    <Label>
                      {connection?.status || "Not connected"}
                      {connection?.last_scanned_at
                        ? " · Last scan " +
                          new Date(connection.last_scanned_at).toLocaleString()
                        : ""}
                    </Label>
                    {connection?.status === "connected" ? (
                      <>
                        <Button
                          loading={busy}
                          onPress={() =>
                            void run(async () => {
                              const result = await invoke({
                                action: "scan",
                                provider,
                              });
                              await syncNow();
                              setNotice(
                                String(result.reviewed) +
                                  " messages processed. Review detections in Activity.",
                              );
                            })
                          }
                        >
                          Scan recent receipts
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onPress={() => setDisconnect(provider)}
                        >
                          Disconnect mailbox
                        </Button>
                      </>
                    ) : (
                      <Button
                        loading={busy}
                        disabled={!consent}
                        onPress={() =>
                          void run(async () => {
                            const result = await invoke({
                              action: "connect",
                              provider,
                              consent: true,
                              returnKind: usesNativeAuthBrowser()
                                ? "native"
                                : "web",
                            });
                            await openAuthBrowser(
                              result.url,
                              authBrowserRedirect("mailboxes"),
                            );
                          })
                        }
                      >
                        {"Connect " +
                          (provider === "gmail" ? "Gmail" : "Outlook")}
                      </Button>
                    )}
                    <Label>
                      After provider consent, return here and refresh. If a
                      connection was interrupted, connect again.
                    </Label>
                  </View>
                </Card>
              );
            })}
          </>
        )}
        {notice ? (
          <Label accessibilityLiveRegion="polite">{notice}</Label>
        ) : null}
        {error ? <Label accessibilityRole="alert">{error}</Label> : null}
      </View>
      <Confirm
        visible={!!disconnect}
        title="Disconnect mailbox?"
        body="Remove Subloom’s stored mailbox access and stop future scans. Existing extracted detections remain until you dismiss or delete account data. For Microsoft, also revoke app consent in your Microsoft account settings if you want the provider grant removed."
        action="Disconnect mailbox"
        onClose={() => setDisconnect(null)}
        onConfirm={async () => {
          const result = await invoke({
            action: "disconnect",
            provider: disconnect,
          });
          setNotice(
            result.providerRevoked
              ? "Stored access removed and Google grant revoked."
              : "Stored access removed. You can also revoke the provider grant in your account settings.",
          );
          await query.refetch();
        }}
      />
    </Page>
  );
}
export default function MailboxRoute() {
  const identity = useApp((s) => s.identity);
  return <Mailboxes key={identity} identity={identity} />;
}
