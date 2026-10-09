import { Tabs, Redirect, router, usePathname } from "expo-router";
import { View, Pressable, Platform } from "react-native";
import {
  House,
  Layers2,
  Activity,
  Settings2,
  Plus,
  ShieldCheck,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react-native";
import { Brand } from "../../components/ui/Brand";
import { Button, Label } from "../../components/ui/Primitives";
import { useTheme, useWide } from "../../theme/useTheme";
import { tokens } from "../../theme/tokens";
import { useApp } from "../../store/app";
const navigation: {
  path: "/" | "/subscriptions" | "/activity" | "/settings";
  title: string;
  icon: LucideIcon;
}[] = [
  { path: "/", title: "Overview", icon: House },
  { path: "/subscriptions", title: "Subscriptions", icon: Layers2 },
  { path: "/activity", title: "Activity", icon: Activity },
  { path: "/settings", title: "Settings", icon: Settings2 },
];
function Sidebar() {
  const { colors } = useTheme(),
    path = usePathname(),
    email = useApp((s) => s.email),
    pending = useApp((s) => s.data.outbox.length),
    syncError = useApp((s) => s.syncError),
    demo = useApp((s) => s.data.demo);
  return (
    <View
      style={{
        width: 232,
        backgroundColor: colors.sidebar,
        borderRightWidth: 1,
        borderColor: colors.border,
        padding: 24,
        paddingTop: 32,
      }}
    >
      <Brand />
      <View style={{ height: 46 }} />
      <Label
        size={9}
        bold
        color={colors.faint}
        style={{ letterSpacing: 1.6, marginBottom: 16 }}
      >
        YOUR WORKSPACE
      </Label>
      {navigation.map(({ path: destination, title, icon: Icon }) => {
        const selected = path === destination;
        return (
          <Pressable
            key={destination}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => router.push(destination)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 48,
              paddingHorizontal: 14,
              borderRadius: 10,
              marginBottom: 7,
              backgroundColor: selected ? colors.mint : "transparent",
            }}
          >
            <Icon
              size={18}
              color={selected ? colors.primary : colors.secondary}
              strokeWidth={selected ? 2.1 : 1.7}
            />
            <Label
              size={13}
              bold={selected}
              color={selected ? colors.primary : colors.secondary}
            >
              {title}
            </Label>
            {selected && (
              <View
                style={{
                  marginLeft: "auto",
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: colors.primary,
                }}
              />
            )}
          </Pressable>
        );
      })}
      <View style={{ marginTop: 23 }}>
        <Button
          icon={Plus}
          small
          onPress={() => router.push("/subscription/new")}
        >
          Add subscription
        </Button>
      </View>
      <View style={{ flex: 1 }} />
      <View
        style={{
          padding: 16,
          borderRadius: 14,
          backgroundColor: colors.background,
          gap: 10,
        }}
      >
        <ShieldCheck color={colors.primary} size={20} />
        <Label size={12} bold>
          A little peace of mind.
        </Label>
        <Label size={11} color={colors.secondary}>
          Your subscriptions, organized. Your data, always yours.
        </Label>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/privacy")}
          style={{
            flexDirection: "row",
            gap: 6,
            alignItems: "center",
            minHeight: 44,
          }}
        >
          <Label size={11} color={colors.primary} bold>
            Our privacy promise
          </Label>
          <ArrowUpRight size={13} color={colors.primary} />
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/settings")}
        style={{
          paddingTop: 25,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 18,
            backgroundColor: colors.mintStrong,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Label bold color={colors.primary}>
            {email ? email[0]?.toUpperCase() : "Y"}
          </Label>
        </View>
        <View style={{ flex: 1 }}>
          <Label bold size={12}>
            {demo
              ? "Sample workspace"
              : email
                ? "Your account"
                : "Your personal space"}
          </Label>
          <Label size={10} color={colors.secondary}>
            {syncError
              ? "Sync needs attention"
              : pending
                ? pending + " changes to sync"
                : email
                  ? "Cloud sync connected"
                  : "Saved on this device"}
          </Label>
        </View>
      </Pressable>
    </View>
  );
}
export default function TabLayout() {
  const { colors } = useTheme(),
    wide = useWide(),
    onboarded = useApp((s) => s.data.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;
  return (
    <View
      style={{
        flex: 1,
        flexDirection: "row",
        backgroundColor: colors.background,
      }}
    >
      {wide && <Sidebar />}
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.secondary,
            tabBarStyle: {
              display: wide ? "none" : "flex",
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              height: Platform.OS === "ios" ? 84 : 72,
              paddingTop: 9,
              paddingBottom: Platform.OS === "ios" ? 26 : 12,
            },
            tabBarLabelStyle: { fontFamily: tokens.fonts.medium, fontSize: 10 },
            sceneStyle: { backgroundColor: colors.background },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: "Home",
              tabBarIcon: ({ color, size }) => (
                <House color={color} size={size - 3} />
              ),
            }}
          />
          <Tabs.Screen
            name="subscriptions"
            options={{
              title: "Subscriptions",
              tabBarIcon: ({ color, size }) => (
                <Layers2 color={color} size={size - 3} />
              ),
            }}
          />
          <Tabs.Screen
            name="activity"
            options={{
              title: "Activity",
              tabBarIcon: ({ color, size }) => (
                <Activity color={color} size={size - 3} />
              ),
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: "Settings",
              tabBarIcon: ({ color, size }) => (
                <Settings2 color={color} size={size - 3} />
              ),
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}
