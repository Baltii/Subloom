import { useEffect } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { DMSans_600SemiBold } from "@expo-google-fonts/dm-sans/600SemiBold";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import NetInfo from "@react-native-community/netinfo";
import { useReducedMotion } from "react-native-reanimated";
import { useApp, hydrate, readableError } from "../store/app";
import { supabase, startSessionRefresh } from "../services/supabase";
import { syncNow } from "../services/sync";
import { useTheme } from "../theme/useTheme";
import { Brand } from "../components/ui/Brand";
import { Button, Label, Toast } from "../components/ui/Primitives";
import { LoadingSkeleton } from "../components/ui/LoadingSkeleton";
import { installNotificationNavigation } from "../services/notifications";
export { ErrorBoundary } from "expo-router";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: true },
  },
});
function Session() {
  const identity = useApp((s) => s.identity),
    outboxSize = useApp((s) => s.data.outbox.length),
    hydrated = useApp((s) => s.hydrated);
  const { refetch } = useQuery({
    queryKey: ["sync", identity, outboxSize],
    queryFn: async () => {
      await syncNow();
      return true;
    },
    enabled: hydrated && identity !== "guest",
    refetchInterval: 60_000,
  });
  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!supabase) {
        await hydrate();
        return;
      }
      const { data, error } = await supabase.auth.getSession();
      if (!alive) return;
      if (error)
        useApp.setState({
          syncError:
            "Your session could not be restored. Guest data is available on this device.",
        });
      useApp.setState({ email: data.session?.user.email || null });
      await hydrate(data.session?.user.id || "guest");
    })().catch((error) => useApp.setState({ error: readableError(error) }));
    const auth = supabase?.auth.onAuthStateChange((_event, session) => {
      // Defer storage work outside the auth callback to avoid Supabase auth-lock deadlocks.
      setTimeout(() => {
        if (alive) {
          useApp.setState({ email: session?.user.email || null });
          const nextIdentity = session?.user.id || "guest";
          if (
            useApp.getState().identity !== nextIdentity ||
            !useApp.getState().hydrated
          )
            void hydrate(nextIdentity);
        }
      }, 0);
    });
    const cleanup = startSessionRefresh();
    return () => {
      alive = false;
      auth?.data.subscription.unsubscribe();
      cleanup();
    };
  }, []);
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        if (state.isConnected && hydrated && identity !== "guest")
          void refetch();
      }),
    [hydrated, identity, refetch],
  );
  useEffect(() => {
    if (Platform.OS !== "web")
      return installNotificationNavigation((path) => router.push(path as "/"));
  }, []);
  return null;
}
function Shell() {
  const reduced = useReducedMotion();
  const { colors, isDark } = useTheme(),
    hydrated = useApp((s) => s.hydrated),
    error = useApp((s) => s.error);
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={["top", "left", "right"]}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <Session />
      {!hydrated ? (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            gap: 24,
            padding: 32,
          }}
        >
          <Brand />
          {error ? (
            <>
              <Label color={colors.error}>{error}</Label>
              <Button onPress={() => void hydrate()}>Retry loading</Button>
            </>
          ) : (
            <LoadingSkeleton />
          )}
        </View>
      ) : (
        <>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: reduced ? "none" : "slide_from_right",
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen
              name="subscription/new"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen
              name="subscription/edit"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen name="import" options={{ presentation: "modal" }} />
          </Stack>
          <Toast />
        </>
      )}
    </SafeAreaView>
  );
}
export default function RootLayout() {
  const [fontsLoaded, error] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  if (!fontsLoaded && !error)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#F8FAF8",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color="#087F68" />
      </View>
    );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Shell />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
