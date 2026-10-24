import { View } from "react-native";
import { CreditCard, Download, FileSearch, Check } from "lucide-react-native";
import { Card, Heading, Label } from "../ui/Primitives";
import { useTheme } from "../../theme/useTheme";
export function ProFeatures() {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: 24 }}>
      <Heading size={20}>Less sorting. More living.</Heading>
      {[
        {
          icon: FileSearch,
          title: "Find the subscriptions hiding in statements",
          body: "Import a CSV and review recurring charges. You choose what becomes a subscription.",
        },
        {
          icon: Download,
          title: "Take your transaction reports with you",
          body: "Export imported transactions as CSV, with original amounts and currencies intact.",
        },
        {
          icon: CreditCard,
          title: "Room for up to 50 cards & wallets",
          body: "Keep your saved billing labels together. Free includes 3 combined.",
        },
      ].map(({ icon: Icon, title, body }) => (
        <View key={title} style={{ flexDirection: "row", gap: 14 }}>
          <Icon size={20} color={colors.primary} strokeWidth={1.7} />
          <View style={{ flex: 1, gap: 5 }}>
            <Label bold>{title}</Label>
            <Label size={13} color={colors.secondary}>
              {body}
            </Label>
          </View>
        </View>
      ))}
      <View
        style={{
          paddingTop: 20,
          borderTopWidth: 1,
          borderColor: colors.border,
          gap: 9,
        }}
      >
        <View style={{ flexDirection: "row", gap: 7, alignItems: "center" }}>
          <Check size={16} color={colors.primary} />
          <Label bold size={13}>
            Your essentials stay free
          </Label>
        </View>
        <Label size={13} color={colors.secondary}>
          Manual tracking, reminders, calendar, JSON backup and basic
          subscription CSV. Your saved records stay yours if Pro ends.
        </Label>
      </View>
    </Card>
  );
}
