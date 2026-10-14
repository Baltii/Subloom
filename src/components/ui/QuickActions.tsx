import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, View } from "react-native";
import { router, type Href } from "expo-router";
import {
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  Download,
  History,
  Import,
  Mail,
  Plus,
  ReceiptText,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";
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
    title: "Import a receipt",
    detail: "Review details from text or a screenshot",
    route: "/import",
    icon: ReceiptText,
    keywords: "scan detection",
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
    title: "Monthly budgets",
    detail: "Category limits in each original currency",
    route: "/budgets",
    icon: Wallet,
    keywords: "spending limits",
    group: "Planning",
  },
  {
    group: "Planning",
    title: "Cards & transactions",
    detail: "Manage your cards and recorded payments",
    route: "/finance",
    icon: Wallet,
  },
  {
    title: "Savings simulator",
    detail: "Compare possible recurring savings",
    route: "/savings",
    icon: ChartNoAxesCombined,
    group: "Planning",
  },
  {
    title: "Price history",
    detail: "Review recorded price and billing changes",
    route: "/price-history",
    icon: History,
    group: "Planning",
  },
  {
    title: "Cancellation assistant",
    detail: "Plan provider steps and record confirmation",
    route: "/cancellation",
    icon: ShieldCheck,
    keywords: "cancel",
    group: "Planning",
  },
  {
    title: "CSV import & export",
    detail: "Review a spreadsheet or export subscriptions",
    route: "/csv",
    icon: Import,
    keywords: "spreadsheet file download",
    group: "Import & sharing",
  },
  {
    title: "Calendar export",
    detail: "Save renewal dates to an .ics file",
    route: "/calendar-export",
    icon: CalendarDays,
    group: "Import & sharing",
  },
  {
    title: "Family workspaces",
    detail: "Shared records and cost splits · account required",
    route: "/workspaces",
    icon: Users,
    group: "Import & sharing",
  },
  {
    title: "Team workspaces and SSO",
    detail: "Organization access · provider setup required",
    route: "/team",
    icon: Users,
    keywords: "saml enterprise",
    group: "Import & sharing",
  },
  {
    title: "Mailbox discovery",
    detail: "Read-only scans · account and provider setup required",
    route: "/mailboxes",
    icon: Mail,
    keywords: "gmail outlook email",
    group: "Connections",
  },
  {
    title: "Receipt forwarding",
    detail: "Your private address and source permissions",
    route: "/sources",
    icon: Mail,
    group: "Connections",
  },
  {
    title: "Settings",
    detail: "Appearance, reminders, account and privacy",
    route: "/settings",
    icon: Settings2,
    keywords: "preferences timezone notifications",
    group: "Everyday",
  },
  {
    title: "Data & privacy",
    detail: "Export, permissions and account controls",
    route: { pathname: "/settings", params: { section: "Data & privacy" } },
    icon: Download,
    group: "Connections",
  },
];

export function matchingActions(query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return toolActions
    .filter((action) =>
      words.every((word) =>
        `${action.title} ${action.detail} ${action.keywords || ""}`
          .toLowerCase()
          .includes(word),
      ),
    )
    .sort(
      (a, b) =>
        ["Everyday", "Planning", "Import & sharing", "Connections"].indexOf(
          a.group,
        ) -
        ["Everyday", "Planning", "Import & sharing", "Connections"].indexOf(
          b.group,
        ),
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
        description="Find a tool or jump to your next task."
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
                accessibilityLabel={action.title}
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
                  <Label bold size={14}>
                    {action.title}
                  </Label>
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
