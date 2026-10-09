import { View } from "react-native";
import { Card, Heading, Label, Page } from "../components/ui/Primitives";
import { useTheme } from "../theme/useTheme";
export default function Help() {
  const { colors } = useTheme();
  const entries = [
    [
      "How do I start?",
      "Tap Add, choose a service or enter a custom name, and confirm your real price and renewal date. Subloom estimates monthly and annual costs from that billing schedule.",
    ],
    [
      "Does Subloom cancel subscriptions?",
      "No. Open Manage with provider on a subscription to handle billing. Record cancellation afterward to keep your Subloom list accurate.",
    ],
    [
      "What works offline?",
      "Tracking, changes, settings, spending estimates, text receipt extraction, and review work on this device. Connected accounts queue changes until a successful sync. Server reminders need a configured backend and are based on the last synced information.",
    ],
    [
      "How do reminders work?",
      "Connect an account, enable push in a native development build or email, and choose your reminder days/time. Server jobs handle delivery when the app is closed. Guest tracking does not send alerts.",
    ],
    [
      "Why is a receipt missing details?",
      "Receipt formats vary. Dates must be clear, prices need a supported currency, and recurring wording needs to be present. Suggestions never replace your judgment. Review uncertain details before confirming.",
    ],
    [
      "What needs configuration?",
      "Supabase authentication and migrations, deployed Edge Functions, cron/Vault secrets, a verified Resend sending/receiving domain, and EAS APNs/FCM configuration. Screenshot OCR additionally needs the server-side Google Cloud Vision API key. See the repository README and docs/SETUP.md.",
    ],
    [
      "Need help with this build?",
      "This is a self-hosted application. Contact the operator of your Subloom deployment. A support address should be configured by the operator before store publication.",
    ],
  ];
  return (
    <Page title="A little help." subtitle="Good questions. Clear answers." back>
      <View
        style={{ maxWidth: 750, width: "100%", alignSelf: "center", gap: 18 }}
      >
        {entries.map(([title, body]) => (
          <Card key={title} style={{ gap: 12 }}>
            <Heading size={18}>{title}</Heading>
            <Label size={13} color={colors.secondary}>
              {body}
            </Label>
          </Card>
        ))}
      </View>
    </Page>
  );
}
