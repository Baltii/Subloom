import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Copy, Mail, Plus, Trash2 } from "lucide-react-native";
import { router } from "expo-router";
import { supabase } from "../services/supabase";
import { useApp, notify, readableError } from "../store/app";
import { useTheme } from "../theme/useTheme";
import {
  Badge,
  Button,
  Card,
  Heading,
  Label,
  Page,
} from "../components/ui/Primitives";
type Alias = { id: string; address: string; expires_at: string };
export default function Sources() {
  const { colors } = useTheme(),
    identity = useApp((s) => s.identity),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["aliases", identity],
    enabled: Boolean(supabase && identity !== "guest"),
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase!.functions.invoke(
        "detection-sources",
        { body: { action: "list" } },
      );
      if (error)
        throw new Error(
          "Receipt forwarding is not configured yet. Follow the backend setup guide.",
        );
      return data.aliases as Alias[];
    },
  });
  async function mutate(action: string, id?: string) {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase!.functions.invoke("detection-sources", {
        body: { action, id },
      });
      if (error)
        throw new Error(
          "Could not update the address. Check backend configuration and try again.",
        );
      await query.refetch();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page
      title="Discover, on your terms."
      subtitle="Choose exactly what Subloom can read."
      back
    >
      <View
        style={{ maxWidth: 700, width: "100%", alignSelf: "center", gap: 22 }}
      >
        <Card style={{ gap: 18 }}>
          <Mail size={26} color={colors.primary} />
          <Heading size={21}>Forward a receipt. Find a subscription.</Heading>
          <Label color={colors.secondary}>
            Your private receipt address turns forwarded confirmation emails
            into suggestions. You review every detection before it enters your
            list.
          </Label>
          {identity === "guest" || !supabase ? (
            <Button onPress={() => router.push("/auth")}>
              Connect an account to get an address
            </Button>
          ) : (
            <>
              {query.isLoading && (
                <Label color={colors.secondary}>
                  Loading your forwarding addresses…
                </Label>
              )}
              {query.data?.map((alias) => (
                <View
                  key={alias.id}
                  style={{
                    padding: 16,
                    borderRadius: 13,
                    backgroundColor: colors.background,
                    gap: 12,
                  }}
                >
                  <Label bold size={12} selectable>
                    {alias.address}
                  </Label>
                  <Label size={11} color={colors.secondary}>
                    Expires {new Date(alias.expires_at).toLocaleDateString()}
                  </Label>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Button
                      small
                      icon={Copy}
                      variant="secondary"
                      onPress={() => {
                        void Clipboard.setStringAsync(alias.address).then(() =>
                          notify("Receipt address copied."),
                        );
                      }}
                    >
                      Copy address
                    </Button>
                    <Button
                      small
                      icon={Trash2}
                      variant="danger"
                      loading={busy}
                      onPress={() => void mutate("revoke", alias.id)}
                    >
                      Revoke
                    </Button>
                  </View>
                </View>
              ))}
              <Button
                icon={Plus}
                loading={busy}
                disabled={(query.data?.length ?? 0) >= 3}
                onPress={() => void mutate("create")}
              >
                Create a private address
              </Button>
            </>
          )}
          <Label size={11} color={colors.secondary}>
            Forward only relevant receipt emails. Inbound text is processed
            transiently; Subloom retains extracted details and minimal evidence
            metadata. Attachments are not ingested. Addresses expire after 90
            days and can be revoked immediately.
          </Label>
          {(error || query.error) && (
            <Label color={colors.error} size={12}>
              {error || query.error?.message}
            </Label>
          )}
        </Card>
        <Card style={{ gap: 13 }}>
          <Heading size={19}>Connected mailboxes</Heading>
          <Badge tone="neutral">Future release</Badge>
          <Label size={13} color={colors.secondary}>
            Gmail and Outlook scanning need separate provider verification and
            an explicit consent flow. No mailbox access is enabled.
          </Label>
        </Card>
        <Card style={{ gap: 13 }}>
          <Heading size={19}>Device notification detection</Heading>
          <Badge tone="neutral">Not available</Badge>
          <Label size={13} color={colors.secondary}>
            Android notification detection requires a separate policy review and
            native implementation. iOS does not provide an equivalent
            device-wide listener.
          </Label>
        </Card>
      </View>
    </Page>
  );
}
