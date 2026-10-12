import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { View } from "react-native";
import { router } from "expo-router";
import { useApp, readableError } from "../store/app";
import { supabase } from "../services/supabase";
import { signInOrganization } from "../services/oauth";
import { ssoProvider } from "../domain/sso";
import {
  Button,
  Card,
  Field,
  Heading,
  Label,
  Page,
} from "../components/ui/Primitives";
function Team({ identity }: { identity: string }) {
  const demo = useApp((s) => s.data.demo),
    [domain, setDomain] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["sso-provider", identity],
    enabled: !!supabase && identity !== "guest" && !demo,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase!.auth.getClaims();
      if (error || data?.claims.sub !== identity)
        throw new Error("Session changed. Sign in through SSO again.");
      return ssoProvider(data.claims);
    },
  });
  return (
    <Page
      title="Your team, together."
      subtitle="Organization sign-in and shared subscriptions."
      back
    >
      <View
        style={{ gap: 18, maxWidth: 700, width: "100%", alignSelf: "center" }}
      >
        <Card style={{ gap: 14 }}>
          <Heading size={21}>Sign in through your organization</Heading>
          <Label>
            Use the domain your administrator registered for SAML SSO. Your
            organization account can be separate from your personal account,
            even with the same email.
          </Label>
          <Field
            label="Organization domain"
            placeholder="company.com"
            value={domain}
            onChangeText={setDomain}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Button
            loading={busy}
            disabled={!domain.trim() || demo}
            onPress={() => {
              setBusy(true);
              setError(null);
              void signInOrganization(domain)
                .catch((e) => setError(readableError(e)))
                .finally(() => setBusy(false));
            }}
          >
            Continue with organization SSO
          </Button>
          {error || query.error ? (
            <Label accessibilityRole="alert">
              {error || query.error?.message}
            </Label>
          ) : null}
        </Card>
        <Card style={{ gap: 14 }}>
          <Heading size={21}>Shared billing, with access controls</Heading>
          <Label>
            Team owners manage subscriptions, billing owners, cost splits and
            invitations. Members can read shared records. Access requires both a
            workspace invitation and a session from the team’s SSO provider.
          </Label>
          {query.data ? (
            <>
              <Label>Organization SSO verified for this session.</Label>
              <Button onPress={() => router.push("/team-workspaces")}>
                Manage team workspaces
              </Button>
            </>
          ) : (
            <Label>
              Sign in through SSO to create or join a team workspace. Personal
              and family subscriptions stay in their own spaces.
            </Label>
          )}
          <Button
            variant="secondary"
            loading={query.isFetching}
            disabled={identity === "guest" || demo}
            onPress={() => void query.refetch()}
          >
            Check SSO session
          </Button>
        </Card>
      </View>
    </Page>
  );
}
export default function TeamRoute() {
  const identity = useApp((s) => s.identity);
  return <Team key={identity} identity={identity} />;
}
