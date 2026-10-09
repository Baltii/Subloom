import { Card, Heading, Label, Page } from "../components/ui/Primitives";
import { View } from "react-native";
import { useTheme } from "../theme/useTheme";
export default function Privacy() {
  const { colors } = useTheme();
  const sections = [
    [
      "Your data stays yours.",
      "Subloom stores subscription details, preferences, and the minimum receipt metadata needed for review and duplicate prevention. Guest data stays on your device; account data syncs to your configured Supabase project. Data is never used for advertising.",
    ],
    [
      "Receipt access is your choice.",
      "Pasted receipt text is parsed on-device. Forwarded email text is processed transiently by the configured backend. Screenshot OCR sends your selected image to Google Cloud Vision only after you explicitly agree. Subloom does not retain the original image. No AI extraction service receives your data.",
    ],
    [
      "Permissions appear when relevant.",
      "Notification permission is requested only when you enable push. The photo picker opens only when you choose a screenshot. No bank, card-number, contact, accessibility, or mailbox access is requested.",
    ],
    [
      "Local storage and device privacy.",
      "On native devices, account tokens use SecureStore and tracking data uses app-private SQLite. Device backups and unlocked devices may expose local financial data. The web preview uses browser storage and should be used on a trusted device.",
    ],
    [
      "You can leave at any time.",
      "Export your data in Settings. Revoke receipt addresses under Receipt forwarding. Delete your account to remove cloud records and local account/guest data on this device. Other signed-in devices clear access when their session is invalidated; their offline cached data requires local clearing.",
    ],
    [
      "Reminder privacy.",
      "Lock-screen content is private by default. Email reminders are sent only to your verified account address through Resend. Enable only the channels you want. Quiet hours and your timezone determine delivery timing.",
    ],
  ];
  return (
    <Page
      title="Private by design."
      subtitle="A clear explanation, without the fine-print feeling."
      back
    >
      <View
        style={{ maxWidth: 750, width: "100%", alignSelf: "center", gap: 18 }}
      >
        {sections.map(([title, body]) => (
          <Card key={title} style={{ gap: 13 }}>
            <Heading size={19}>{title}</Heading>
            <Label color={colors.secondary} size={13}>
              {body}
            </Label>
          </Card>
        ))}
      </View>
    </Page>
  );
}
