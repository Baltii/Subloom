import { useState, type ReactNode } from "react";
import { Platform, Pressable, View, useWindowDimensions } from "react-native";
import {
  ArrowRight,
  CreditCard,
  Landmark,
  Pencil,
  Repeat2,
  Trash2,
  WalletCards,
} from "lucide-react-native";
import Svg, { Path, Rect } from "react-native-svg";
import type { PaymentSource } from "../../domain/payments";
import { billingMethodLabel } from "../../domain/billingMethods";
import { useTheme } from "../../theme/useTheme";
import { Button, Card, Heading, IconButton, Label } from "../ui/Primitives";
import { CardNetworkMark, PaymentMethodIcon } from "./PaymentMethodIcon";

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof CreditCard;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Icon size={20} color={colors.secondary} strokeWidth={1.7} />
        <Heading size={19}>{title}</Heading>
      </View>
      {children}
    </View>
  );
}

function CardChip({ ink }: { ink: string }) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      style={{ flexDirection: "row", alignItems: "center", gap: 15 }}
    >
      <Svg width={42} height={32} viewBox="0 0 42 32">
        <Rect
          x="1"
          y="1"
          width="40"
          height="30"
          rx="7"
          fill="#D6C399"
          stroke="#8C7650"
          strokeWidth="1.2"
        />
        <Path
          d="M15 1v9l-5 6 5 6v9M27 1v9l5 6-5 6v9M1 10h14m12 0h14M1 22h14m12 0h14M10 16H1m31 0h9M15 10h12v12H15z"
          fill="none"
          stroke="#8C7650"
          strokeWidth="1"
        />
      </Svg>
      <Svg width={24} height={27} viewBox="0 0 24 26">
        <Path
          d="M6 9c2 2 2 6 0 8M11 6c4 4 4 10 0 14M16 3c6 6 6 14 0 20"
          stroke={ink}
          strokeOpacity={0.7}
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}

function BankCardFace({
  source,
  onView,
}: {
  source: PaymentSource;
  onView: () => void;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false),
    [hovered, setHovered] = useState(false);
  const accented =
    source.cardBrand === "Mastercard" ||
    source.cardBrand === "Discover" ||
    source.cardBrand === "JCB";
  const background = accented ? colors.hero : colors.surface,
    ink = accented ? colors.heroText : colors.text,
    muted = accented ? colors.heroSecondary : colors.secondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        "View subscriptions billed to " + billingMethodLabel(source)
      }
      accessibilityHint="Opens the subscriptions assigned to this card"
      onPress={onView}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => ({
        aspectRatio: 1.586,
        padding: 22,
        borderRadius: 22,
        justifyContent: "space-between",
        backgroundColor: background,
        opacity: pressed ? 0.9 : 1,
        borderWidth: 2,
        borderColor: hovered ? muted : "transparent",
        ...(Platform.OS === "web" && focused
          ? {
              outlineStyle: "solid",
              outlineWidth: 2,
              outlineOffset: 4,
              outlineColor: colors.primary,
            }
          : {}),
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Label size={16} bold color={ink} numberOfLines={2}>
            {source.name}
          </Label>
          <Label size={12} color={muted}>
            {source.cardBrand || "Card"}
          </Label>
        </View>
        <CardNetworkMark source={source} color={ink} />
      </View>
      <CardChip ink={ink} />
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 14 }}>
        <Label
          size={19}
          color={muted}
          style={{ letterSpacing: 2, flexShrink: 1 }}
          numberOfLines={1}
        >
          •••• •••• ••••
        </Label>
        {source.last4 ? (
          <Label bold size={26} color={ink} style={{ letterSpacing: 2 }}>
            {source.last4}
          </Label>
        ) : (
          <Label size={13} color={ink} style={{ flexShrink: 1 }}>
            No last four added
          </Label>
        )}
      </View>
    </Pressable>
  );
}

export function SavedBillingMethods({
  sources,
  counts,
  disabled,
  onView,
  onEdit,
  onRemove,
}: {
  sources: PaymentSource[];
  counts: Map<string, number>;
  disabled: boolean;
  onView: (source: PaymentSource) => void;
  onEdit: (source: PaymentSource) => void;
  onRemove: (source: PaymentSource) => void;
}) {
  const { width } = useWindowDimensions(),
    { colors } = useTheme();
  const cards = sources.filter((source) => source.kind === "card"),
    wallets = sources.filter((source) => source.kind === "wallet"),
    banks = sources.filter((source) => source.kind === "bank");
  const beside = width >= 900 && cards.length === 1 && wallets.length > 0;
  const available = Math.min(width, 1076) - (width >= 900 ? 76 : 44),
    sectionWidth = beside ? (available - 24) / 2 : available,
    columns = !beside && sectionWidth >= 650 ? 2 : 1,
    cardWidth = (sectionWidth - 20 * (columns - 1)) / columns;
  function actions(source: PaymentSource, card = false) {
    const count = counts.get(source.id) || 0;
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1, alignItems: "flex-start" }}>
          <Button
            small
            variant="ghost"
            icon={card ? Repeat2 : ArrowRight}
            accessibilityLabel={
              "View subscriptions billed to " + billingMethodLabel(source)
            }
            onPress={() => onView(source)}
          >
            {count + (count === 1 ? " subscription" : " subscriptions")}
          </Button>
        </View>
        {source.kind !== "bank" && (
          <IconButton
            icon={Pencil}
            disabled={disabled}
            label={"Edit " + billingMethodLabel(source)}
            onPress={() => onEdit(source)}
          />
        )}
        <IconButton
          icon={Trash2}
          disabled={disabled}
          label={"Remove " + billingMethodLabel(source)}
          onPress={() => onRemove(source)}
        />
      </View>
    );
  }
  function walletList(
    items: PaymentSource[],
    title: string,
    Icon: typeof WalletCards,
  ) {
    if (!items.length) return null;
    return (
      <Section title={title} icon={Icon}>
        <Card style={{ padding: 20, gap: 24 }}>
          {items.map((source) => (
            <View key={source.id} style={{ gap: 14 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
              >
                <PaymentMethodIcon source={source} size={32} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Label bold size={16}>
                    {source.name}
                  </Label>
                  <Label size={12} color={colors.secondary}>
                    {source.walletProvider &&
                    source.walletProvider !== source.name
                      ? source.walletProvider
                      : source.kind === "bank"
                        ? "Bank"
                        : "Digital wallet"}
                  </Label>
                </View>
              </View>
              {actions(source)}
            </View>
          ))}
        </Card>
      </Section>
    );
  }
  return (
    <View style={{ gap: 28 }}>
      <View
        style={{
          flexDirection: beside ? "row" : "column",
          gap: 24,
          alignItems: "flex-start",
        }}
      >
        {cards.length > 0 && (
          <View style={{ width: beside ? sectionWidth : "100%" }}>
            <Section title="Cards" icon={CreditCard}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 20 }}>
                {cards.map((source) => (
                  <View key={source.id} style={{ width: cardWidth, gap: 12 }}>
                    <BankCardFace
                      source={source}
                      onView={() => onView(source)}
                    />
                    {actions(source, true)}
                  </View>
                ))}
              </View>
            </Section>
          </View>
        )}
        {wallets.length > 0 && (
          <View style={{ width: beside ? sectionWidth : "100%" }}>
            {walletList(wallets, "Wallets", WalletCards)}
          </View>
        )}
      </View>
      {walletList(banks, "Other saved methods", Landmark)}
    </View>
  );
}
