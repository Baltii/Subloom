import { View } from "react-native";
import { InteractiveSurface } from "./InteractiveSurface";
import { router, type Href } from "expo-router";
import {
  ArrowUpRight,
  CreditCard,
  Radar,
  ShieldCheck,
  PiggyBank,
  Users,
  ReceiptText,
  Palette,
  type LucideIcon,
} from "lucide-react-native";
import { useTheme, useWide } from "../../theme/useTheme";
import { FinancialArt } from "./FinancialArt";
import { Label, SectionTitle } from "./Primitives";
import { tokens } from "../../theme/tokens";

export function DashboardActions() {
  const { colors } = useTheme();
  const wide = useWide();
  return (
    <View style={{ gap: 16, marginBottom: 28 }}>
      <SectionTitle title="A little more control" />
      <View style={{ flexDirection: wide ? "row" : "column", gap: 16 }}>
        <ActionCard
          title="Meet your payment hub"
          body="Which card pays for what? Link your services and keep expiry dates in view."
          action="Organize my cards"
          route="/payments"
          icon={CreditCard}
          illustration
        />
        <ActionCard
          title="Find the charges you missed"
          body="Import a statement. Review recurring merchants and compare actual charges."
          action="Open Subscription Radar"
          route="/payments/radar"
          icon={Radar}
          spotlight
        />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(
          [
            { title: "Renewal rules", route: "/autopilot", icon: ShieldCheck },
            { title: "Plan a reserve", route: "/reserve", icon: PiggyBank },
            { title: "Family balances", route: "/settlements", icon: Users },
            { title: "Import a receipt", route: "/import", icon: ReceiptText },
            { title: "Change theme", route: "/settings", icon: Palette },
          ] satisfies { title: string; route: Href; icon: LucideIcon }[]
        ).map(({ title, route, icon: Icon }) => (
          <InteractiveSurface
            key={title}
            accessibilityRole="button"
            accessibilityLabel={title}
            onPress={() => router.push(route)}
            style={({ pressed, hovered }) => ({
              minHeight: 44,
              paddingHorizontal: 12,
              paddingVertical: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              borderRadius: 12,
              backgroundColor:
                pressed || hovered ? colors.mint : colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            })}
          >
            <Icon size={16} color={colors.primary} />
            <Label size={12} bold>
              {title}
            </Label>
          </InteractiveSurface>
        ))}
      </View>
    </View>
  );
}

function ActionCard({
  title,
  body,
  action,
  route,
  icon: Icon,
  spotlight = false,
  illustration = false,
}: {
  title: string;
  body: string;
  action: string;
  route: Href;
  icon: LucideIcon;
  spotlight?: boolean;
  illustration?: boolean;
}) {
  const { colors } = useTheme();
  const foreground = spotlight ? colors.onSpotlight : colors.heroText;
  const secondary = spotlight
    ? colors.spotlightSecondary
    : colors.heroSecondary;
  return (
    <InteractiveSurface
      accessibilityRole="button"
      accessibilityLabel={action}
      accessibilityHint={body}
      onPress={() => router.push(route)}
      style={({ pressed, hovered }) => ({
        flex: 1,
        minHeight: 216,
        borderRadius: tokens.radius.md,
        padding: 22,
        backgroundColor: spotlight ? colors.spotlight : colors.hero,
        opacity: pressed ? 0.88 : 1,
        borderWidth: 2,
        borderColor: hovered || pressed ? colors.primary : "transparent",
        gap: 14,
      })}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 14, flex: 1 }}
      >
        <View style={{ flex: 1, gap: 9 }}>
          <Icon size={24} color={foreground} strokeWidth={1.8} />
          <Label
            bold
            size={20}
            color={foreground}
            style={{ fontFamily: tokens.fonts.displayBold }}
          >
            {title}
          </Label>
          <Label size={13} color={secondary}>
            {body}
          </Label>
        </View>
        {illustration ? <FinancialArt kind="wallet" size={110} /> : null}
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Label bold size={13} color={foreground} style={{ flex: 1 }}>
          {action}
        </Label>
        <ArrowUpRight size={22} color={foreground} />
      </View>
    </InteractiveSurface>
  );
}
