import { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { accountClient } from "../services/supabase";
import { useApp } from "../store/app";
import { ProFeatureBadge } from "../components/pro/ProFeatureBadge";
import {
  Badge,
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
});
function Mailboxes({ identity }: { identity: string }) {
  const demo = useApp((state) => state.data.demo);
  const [disconnect, setDisconnect] = useState<"gmail" | "outlook" | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  async function invoke(
    body:
      | { action: "status" }
      | { action: "disconnect"; provider: "gmail" | "outlook" },
  ) {
    const client = await accountClient(identity);
    const { data, error } = await client.functions.invoke("mailbox-connect", {
      body,
    });
    if (error || data?.error)
      throw new Error(
        "Mailbox access could not be updated. Try again while connected.",
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
  const connections =
    query.data?.filter((connection) => connection.status !== "disconnected") ||
    [];
  return (
    <Page title="Mailbox discovery" subtitle="Coming soon to Subloom Pro." back>
      <View style={{ gap: 18 }}>
        <Card style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <ProFeatureBadge />
            <Badge tone="neutral">Soon</Badge>
          </View>
          <Heading size={20}>Mailbox discovery is not available yet</Heading>
          <Label>
            Gmail and Outlook receipt discovery will be a Pro feature when it
            launches. Connecting mailboxes and scanning receipts are currently
            disabled.
          </Label>
        </Card>
        {identity !== "guest" && !demo && (
          <Card style={{ gap: 14 }}>
            <Heading size={18}>Previously connected mailboxes</Heading>
            <Label>
              You can still remove access granted before discovery was disabled.
            </Label>
            {query.isPending && <Label>Loading existing connections…</Label>}
            {query.error && (
              <>
                <Label accessibilityRole="alert">{query.error.message}</Label>
                <Button
                  small
                  variant="secondary"
                  onPress={() => void query.refetch()}
                >
                  Retry loading connections
                </Button>
              </>
            )}
            {query.isSuccess && !connections.length && (
              <Label>No mailbox access is currently connected.</Label>
            )}
            {connections.map((connection) => (
              <View key={connection.id} style={{ gap: 8 }}>
                <Label bold>
                  {connection.provider === "gmail" ? "Gmail" : "Outlook"}
                </Label>
                <Button
                  variant="secondary"
                  onPress={() => setDisconnect(connection.provider)}
                >
                  {"Disconnect " +
                    (connection.provider === "gmail" ? "Gmail" : "Outlook")}
                </Button>
              </View>
            ))}
          </Card>
        )}
        {notice && <Label accessibilityLiveRegion="polite">{notice}</Label>}
      </View>
      <Confirm
        visible={!!disconnect}
        title="Disconnect mailbox?"
        body="Remove Subloom’s stored mailbox access. Previously extracted detections stay available. For Microsoft, you can also revoke the provider grant in your Microsoft account settings."
        action="Disconnect mailbox"
        onClose={() => setDisconnect(null)}
        onConfirm={async () => {
          if (!disconnect) return;
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
  const identity = useApp((state) => state.identity);
  return <Mailboxes key={identity} identity={identity} />;
}
