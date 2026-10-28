import {
  Card,
  Heading,
  Label,
  LinkRow,
  Page,
} from "../components/ui/Primitives";
import { View } from "react-native";
import { router } from "expo-router";
import { Mail } from "lucide-react-native";
import { useTheme } from "../theme/useTheme";
export default function Privacy() {
  const { colors } = useTheme();
  const sections = [
    [
      "Your data stays yours.",
      "Subloom stores subscription details, preferences, and the minimum receipt metadata needed for review and duplicate prevention. Guest tracking data stays on your device; account data syncs securely across your devices. Data is never used for advertising.",
    ],
    [
      "Ideas and feedback.",
      "Feedback is sent only when you press Send feedback. Your message, its category and title, optional reply email, app version, and platform are emailed to Subloom’s creator through Resend, with a private backup stored in the app’s backend. Your optional email is used as the reply address. Subscription records are not attached. A temporary, keyed network identifier is used to limit spam; raw IP addresses are not stored in the feedback inbox. Feedback is separate from your account and can be sent without signing in.",
    ],
    [
      "Receipt access is your choice.",
      "Pasted receipt text is parsed on-device. Screenshot OCR sends your selected image to Google Cloud Vision only after you explicitly agree. Subloom does not retain the original image. No AI extraction service receives your data.",
    ],
    [
      "Permissions appear when relevant.",
      "Notification permission is requested only when you enable push. The photo picker opens only when you choose a screenshot. New mailbox connections are currently disabled. No bank, card-number, contact, or accessibility access is requested.",
    ],
    [
      "Connected mailboxes.",
      "New mailbox connections and scans are disabled. Previously stored access tokens remain encrypted and are never included in exports. You can remove stored access below. Outlook consent can also be revoked in your Microsoft account.",
    ],
    [
      "Local storage and device privacy.",
      "On iOS and Android, account tokens use SecureStore and tracking data uses app-private SQLite. The Mac app stores tracking and financial feature data in private files in its sandbox; account sessions use WebKit storage. Device backups and unlocked devices may expose local financial data. The web app uses browser storage and should be used on a trusted device.",
    ],
    [
      "You can leave at any time.",
      "Export your data in Settings. Delete your account to remove synced account records and local account/guest data on this device. Feedback is stored separately from account records in the creator’s private inbox. Other signed-in devices clear access when their session is invalidated; their offline cached data requires local clearing.",
    ],
    [
      "Reminder privacy.",
      "Lock-screen content is private by default. Email reminders are sent only to your verified account address through Resend. Enable only the channels you want. Quiet hours and your timezone determine delivery timing.",
    ],
  ];
  return (
    <Page title="Privacy & permissions" back>
      <View
        style={{ maxWidth: 750, width: "100%", alignSelf: "center", gap: 18 }}
      >
        {sections.map(([title, body]) => (
          <Card key={title} style={{ gap: 13 }}>
            <Heading size={19}>{title}</Heading>
            <Label color={colors.secondary} size={13}>
              {body}
            </Label>
            {title === "Connected mailboxes." && (
              <LinkRow
                icon={Mail}
                title="Manage previous mailbox access"
                onPress={() => router.push("/mailboxes")}
              />
            )}
          </Card>
        ))}
      </View>
    </Page>
  );
}
