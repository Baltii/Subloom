import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, View } from "react-native";
import { router, type Href } from "expo-router";
import {
  ArrowRight,
  CalendarDays,
  CreditCard,
  Download,
  Import,
  Mail,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";
import type { ProFeature } from "../../hooks/useProAccess";
import { ProFeatureBadge } from "../pro/ProFeatureBadge";
import { QuickActionsContext } from "../../hooks/useQuickActions";
import { useApp } from "../../store/app";
import { useTheme } from "../../theme/useTheme";
import { Field, Label } from "./Primitives";
import { PickerSheet } from "./Selection";

export const toolActions: {
  title: string;
  detail: string;
  route: Href;
  icon: LucideIcon;
  keywords?: string;
  proFeature?: ProFeature;
  group: string;
}[] = [
  {
    title: "Add subscription",
    detail: "Track a service and its next renewal",
    route: "/subscription/new",
    icon: Plus,
    group: "Everyday",
  },
  {
    title: "Subscriptions",
    detail: "Find and manage your tracked services",
    route: "/subscriptions",
    icon: Search,
    group: "Everyday",
  },
  {
    title: "Transactions",
    detail: "Review recurring charges · Pro statement imports and exports",
    proFeature: "Statement imports",
    route: "/transactions",
    icon: ReceiptText,
    keywords: "bank statement payments charges pro premium",
    group: "Everyday",
  },
  {
    title: "Import a receipt",
    detail: "Review subscription details from a receipt",
    route: "/import",
    icon: ReceiptText,
    keywords: "scan detection",
    group: "Import",
  },
  {
    title: "CSV import & export",
    detail: "Move your subscription list between apps",
    proFeature: "CSV import & export",
    route: "/csv",
    icon: Import,
    keywords: "spreadsheet file download",
    group: "Import",
  },
  {
    title: "Mailbox discovery",
    detail: "Find subscription receipts in Gmail or Outlook",
    route: "/mailboxes",
    icon: Mail,
    keywords: "gmail outlook email",
    group: "Import",
  },
  {
    title: "Receipt forwarding",
    detail: "Manage your private receipt address",
    route: "/sources",
    icon: Mail,
    group: "Import",
  },
  {
    title: "Cards & wallets",
    detail: "Manage billing methods for your subscriptions",
    route: "/billing-methods",
    icon: CreditCard,
    keywords: "manage billing payment visa mastercard paypal wallet",
    group: "Everyday",
  },
  {
    title: "Monthly budgets",
    detail: "Set subscription spending limits by category",
    route: "/budgets",
    icon: Wallet,
    keywords: "spending limits",
    group: "Manage",
  },
  {
    title: "Calendar export",
    detail: "Save renewal dates to your calendar",
    route: "/calendar-export",
    icon: CalendarDays,
    group: "Manage",
  },
  {
    title: "Settings",
    detail: "Appearance, reminders, account and privacy",
    route: "/settings",
    icon: Settings2,
    keywords: "preferences timezone notifications",
    group: "Manage",
  },
  {
    title: "Data & privacy",
    detail: "Export your data and manage permissions",
    route: { pathname: "/settings", params: { section: "Data & privacy" } },
    icon: Download,
    group: "Manage",
  },
];

export function matchingActions(query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return toolActions
    .filter(
      (action) =>
        (words.length > 0 ||
          action.group === "Everyday" ||
          ["Import a receipt", "Settings"].includes(action.title)) &&
        words.every((word) =>
          `${action.title} ${action.detail} ${action.keywords || ""}`
            .toLowerCase()
            .includes(word),
        ),
    )
    .sort(
      (a, b) =>
        ["Everyday", "Import", "Manage"].indexOf(a.group) -
        ["Everyday", "Import", "Manage"].indexOf(b.group),
    );
}

export function QuickActionsProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const onboarded = useApp((s) => s.data.onboarded);
  const pendingRoute = useRef<Href | null>(null);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  function show() {
    setQuery("");
    setOpen(true);
  }
  useEffect(() => {
    if (Platform.OS !== "web" || !onboarded) return;
    function shortcut(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        (event.code === "KeyK" || event.key.toLowerCase() === "k")
      ) {
        event.preventDefault();
        setQuery("");
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [onboarded]);
  const actions = matchingActions(query);
  return (
    <QuickActionsContext.Provider value={show}>
      {children}
      <PickerSheet
        visible={open}
        title="Quick actions"
        description="Jump to a subscription, import, or setting."
        onClose={() => setOpen(false)}
        onDismiss={() => {
          if (pendingRoute.current) {
            const route = pendingRoute.current;
            pendingRoute.current = null;
            router.push(route);
          }
        }}
      >
        <Field
          label="Search actions"
          placeholder="Try receipt, budget or calendar"
          leading={<Search size={18} color={colors.secondary} />}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
        {actions.length ? (
          actions.map((action, index) => (
            <View key={action.title}>
              {(index === 0 || actions[index - 1]?.group !== action.group) && (
                <Label
                  size={12}
                  bold
                  color={colors.secondary}
                  style={{ marginTop: 12, marginBottom: 6 }}
                >
                  {action.group}
                </Label>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  action.title +
                  (action.proFeature ? ", Pro imports and exports" : "")
                }
                onPress={() => {
                  setOpen(false);
                  if (Platform.OS === "ios")
                    pendingRoute.current = action.route;
                  else router.push(action.route);
                }}
                style={({ pressed }) => ({
                  minHeight: 64,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: pressed ? colors.mint : "transparent",
                })}
              >
                <action.icon size={19} color={colors.primary} />
                <View style={{ flex: 1, gap: 3 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <Label bold size={14}>
                      {action.title}
                    </Label>
                    {action.proFeature && <ProFeatureBadge />}
                  </View>
                  <Label size={12} color={colors.secondary}>
                    {action.detail}
                  </Label>
                </View>
                <ArrowRight size={16} color={colors.secondary} />
              </Pressable>
            </View>
          ))
        ) : (
          <View style={{ paddingVertical: 24, gap: 6 }}>
            <Label bold>No matching actions</Label>
            <Label color={colors.secondary}>
              Try a shorter search, such as “receipt” or “budget”.
            </Label>
          </View>
        )}
      </PickerSheet>
    </QuickActionsContext.Provider>
  );
}
