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
      "Connect an account, enable push in a native development build or email, and choose your reminder days/time. Server jobs handle delivery when the app is closed. On Mac, guest workspaces can enable local system reminders in Settings; opening the app refreshes their schedule.",
    ],
    [
      "Why is a receipt missing details?",
      "Receipt formats vary. Dates must be clear, prices need a supported currency, and recurring wording needs to be present. Suggestions never replace your judgment. Review uncertain details before confirming.",
    ],
    [
      "Can I connect or verify a card?",
      "Subloom tracks subscriptions and transaction records. Import a bank statement to review charges. A statement import does not verify a card, connect a bank, or give Subloom permission to make payments. Your bank and each subscription provider handle payment authorization.",
    ],
    [
      "How are imported charges used?",
      "Review statement rows before importing. Repeated charges can suggest a subscription, but you confirm the match and any new subscription. Your recorded renewal price does not change automatically. Currencies stay separate, and refunds stay separate from charges.",
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
