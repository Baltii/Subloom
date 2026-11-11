import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { router, type Href } from "expo-router";
import {
  ArrowDownRight,
  ArrowUp,
  CalendarDays,
  Check,
  MessageCircle,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAssistantPreference } from "./AssistantPreference";
import {
  containsAssistantSecret,
  mergeAssistantDraft,
  mergeBillingDraft,
  mergeSubscriptionEdit,
  type AssistantAction,
} from "../../domain/assistantProtocol";
import { interpretLocalAssistant } from "../../domain/localAssistant";
import { today } from "../../domain/renewal";
import { interpretAssistantRequest } from "../../services/assistant";
import {
  resolveAssistantAction,
  type AssistantReply,
} from "../../services/assistantActions";
import { readableError, useApp } from "../../store/app";
import { useTheme } from "../../theme/useTheme";
import { tokens } from "../../theme/tokens";
import { Button, Heading, Label } from "../ui/Primitives";

type Turn = { createdAt: number } & (
  | { id: number; role: "user"; text: string }
  | {
      id: number;
      role: "assistant";
      reply: AssistantReply;
      state?: "saved" | "error";
    }
);
const suggestions = [
  {
    text: "Next month’s spending",
    prompt: "What will I spend next month?",
    Icon: CalendarDays,
  },
  {
    text: "Add a subscription",
    prompt: "Help me add a subscription",
    Icon: Plus,
  },
  {
    text: "Change my theme",
    prompt: "Switch to dark mode",
    Icon: SlidersHorizontal,
  },
];

function TypingDot({ delay, color }: { delay: number; color: string }) {
  const progress = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    progress.value = 0;
    if (!reduced)
      progress.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 300, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 300, easing: Easing.inOut(Easing.sin) }),
            withDelay(360, withTiming(0, { duration: 0 })),
          ),
          -1,
        ),
      );
    return () => cancelAnimation(progress);
  }, [delay, progress, reduced]);
  const style = useAnimatedStyle(() => ({
    opacity: reduced ? 0.65 : 0.4 + progress.value * 0.6,
    transform: [{ translateY: reduced ? 0 : -3 * progress.value }],
  }));
  return (
    <Animated.View
      style={[
        { width: 6, height: 6, borderRadius: 3, backgroundColor: color },
        style,
      ]}
    />
  );
}

function MessageTime({
  createdAt,
  color,
}: {
  createdAt: number;
  color: string;
}) {
  const date = new Date(createdAt);
  return (
    <Label
      testID="assistant-message-time"
      size={11}
      color={color}
      accessibilityLabel={date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })}
    >
      {date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })}
    </Label>
  );
}

export function AssistantBubble({ bottom }: { bottom: number }) {
  const { enabled } = useAssistantPreference();
  const identity = useApp((state) => state.identity);
  return enabled ? (
    <AssistantChat key={identity} identity={identity} bottom={bottom} />
  ) : null;
}

function AssistantChat({
  identity,
  bottom,
}: {
  identity: string;
  bottom: number;
}) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const desktop = width >= 700;
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"reply" | "apply" | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const request = useRef<AbortController | null>(null);
  const operation = useRef(false);
  const followup = useRef<string[]>([]);
  const pendingAction = useRef<AssistantAction | undefined>(undefined);
  const lastSubscription = useRef<string | undefined>(undefined);
  const sequence = useRef(0);
  const scroll = useRef<ScrollView>(null);
  const navigation = useRef<Href | null>(null);
  const nearBottom = useRef(true);
  const launcher = useRef<View>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);

  function append(reply: AssistantReply, state?: "saved" | "error") {
    const id = ++sequence.current;
    setTurns((previous) => [
      ...previous.slice(-29),
      { id, role: "assistant", reply, state, createdAt: Date.now() },
    ]);
    setPending(reply.next && "run" in reply.next ? id : null);
  }

  async function send(value: string) {
    const text = value.trim();
    if (!text || operation.current) return;
    if (containsAssistantSecret(text)) {
      append(
        {
          text: "Use saved labels and leave credentials, email addresses, and card numbers out of chat.",
        },
        "error",
      );
      return;
    }
    const snapshot = useApp.getState();
    if (
      !snapshot.hydrated ||
      snapshot.identity !== identity ||
      snapshot.data.demo
    )
      return;
    operation.current = true;
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 22_000);
    const context = [...followup.current.slice(-3), text];
    const id = ++sequence.current;
    nearBottom.current = true;
    setTurns((previous) => [
      ...previous.slice(-29),
      { id, role: "user", text, createdAt: Date.now() },
    ]);
    setDraft("");
    setPending(null);
    setBusy("reply");
    try {
      const previous = pendingAction.current;
      const date = today(snapshot.data.preferences.timezone);
      const local = interpretLocalAssistant(
        text,
        previous?.kind === "add_subscription",
        {
          today: date,
          subscription: lastSubscription.current,
          pending: previous,
        },
      );
      const action =
        previous && /^(?:confirm|save it|yes,? save)[.!]?$/i.test(text)
          ? previous
          : identity === "guest" || local.kind !== "help"
            ? local
            : await interpretAssistantRequest(
                identity,
                { messages: context, today: date, protocol: 2 },
                controller.signal,
              );
      if (controller.signal.aborted)
        throw new Error("The assistant took too long. Try again.");
      const withDraft = mergeAssistantDraft(
        action,
        previous?.kind === "add_subscription" ? previous : undefined,
      );
      const withEdit = mergeSubscriptionEdit(
        withDraft,
        previous?.kind === "edit_subscription" ? previous : undefined,
      );
      const resolved = mergeBillingDraft(
        withEdit,
        previous?.kind === "payment_method" ? previous : undefined,
      );
      const reply = await resolveAssistantAction(resolved, identity);
      if (!mounted.current) return;
      const ongoing =
        reply.awaitingDetails || (reply.next && "run" in reply.next);
      pendingAction.current = ongoing ? resolved : undefined;
      followup.current = ongoing ? context : [];
      if (
        resolved.kind === "subscription" &&
        reply.next &&
        "route" in reply.next &&
        reply.title
      )
        lastSubscription.current = reply.title;
      append(reply);
    } catch (error) {
      if (mounted.current) {
        append(
          {
            text: controller.signal.aborted
              ? "The assistant took too long. Try again."
              : readableError(error),
          },
          "error",
        );
        setDraft(text);
      }
    } finally {
      clearTimeout(timeout);
      request.current = null;
      operation.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  async function apply(run: () => Promise<string>) {
    if (operation.current) return;
    operation.current = true;
    setPending(null);
    setBusy("apply");
    try {
      const text = await run();
      if (mounted.current) {
        const confirmed = pendingAction.current;
        if (confirmed?.kind === "add_subscription")
          lastSubscription.current = confirmed.name ?? undefined;
        if (confirmed?.kind === "edit_subscription")
          lastSubscription.current =
            confirmed.changes.find(({ field }) => field === "name")?.value ??
            confirmed.subscription ??
            undefined;
        if (confirmed?.kind === "delete_subscription")
          lastSubscription.current = undefined;
        pendingAction.current = undefined;
        followup.current = [];
        append({ text }, "saved");
      }
    } catch (error) {
      if (mounted.current) append({ text: readableError(error) }, "error");
    } finally {
      operation.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  function close() {
    Keyboard.dismiss();
    setOpen(false);
    if (Platform.OS === "web")
      requestAnimationFrame(() => launcher.current?.focus());
  }
  function go(route: Href) {
    const state = useApp.getState();
    if (!state.hydrated || state.identity !== identity || state.data.demo)
      return;
    if (Platform.OS === "ios") navigation.current = route;
    close();
    if (Platform.OS !== "ios") router.push(route);
  }

  return (
    <>
      <Pressable
        ref={launcher}
        testID="assistant-launcher"
        accessibilityRole="button"
        accessibilityLabel="Open AI assistant"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          ...styles.launcher,
          right: Math.max(18, insets.right + 12),
          bottom,
          backgroundColor: pressed ? colors.pressed : colors.primary,
          transform: [{ scale: pressed && !reduced ? 0.96 : 1 }],
        })}
      >
        <MessageCircle size={24} color={colors.onPrimary} strokeWidth={1.9} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType={reduced ? "none" : "fade"}
        onRequestClose={close}
        onDismiss={() => {
          const route = navigation.current;
          navigation.current = null;
          if (
            route &&
            useApp.getState().hydrated &&
            useApp.getState().identity === identity
          )
            router.push(route);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            flex: 1,
            justifyContent: "flex-end",
            alignItems: desktop ? "flex-end" : "stretch",
            paddingTop: insets.top + 12,
            paddingRight: desktop ? 24 : Math.max(10, insets.right),
            paddingLeft: desktop ? 24 : Math.max(10, insets.left),
            paddingBottom: desktop ? 24 : Math.max(10, insets.bottom),
          }}
        >
          <Pressable
            accessible={false}
            onPress={close}
            style={[StyleSheet.absoluteFill, { backgroundColor: "#0C181522" }]}
          />
          <Animated.View
            testID="assistant-panel"
            accessibilityViewIsModal
            entering={
              reduced
                ? undefined
                : FadeInDown.duration(240).easing(
                    Easing.bezier(0.16, 1, 0.3, 1),
                  )
            }
            style={[
              styles.panel,
              {
                width: desktop ? 440 : undefined,
                height: Math.min(
                  desktop ? 640 : 680,
                  height - insets.top - insets.bottom - 28,
                ),
                maxHeight: "100%",
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <View style={[styles.header, { borderColor: colors.border }]}>
              <MessageCircle
                size={21}
                color={colors.primary}
                strokeWidth={1.8}
              />
              <View style={{ flex: 1 }}>
                <Heading size={18}>Subloom</Heading>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close AI assistant"
                onPress={close}
                style={({ pressed }) => [
                  styles.iconButton,
                  { backgroundColor: pressed ? colors.mint : "transparent" },
                ]}
              >
                <X size={20} color={colors.secondary} />
              </Pressable>
            </View>
            <ScrollView
              ref={scroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={100}
              onScroll={({
                nativeEvent: { contentOffset, contentSize, layoutMeasurement },
              }) => {
                nearBottom.current =
                  contentSize.height -
                    layoutMeasurement.height -
                    contentOffset.y <
                  72;
              }}
              onContentSizeChange={() => {
                if (nearBottom.current)
                  scroll.current?.scrollToEnd({
                    animated: !reduced && turns.length > 1,
                  });
              }}
              contentContainerStyle={styles.thread}
            >
              {turns.length === 0 && (
                <View style={styles.empty}>
                  <Heading size={26}>How can I help?</Heading>
                  <View
                    style={{
                      marginTop: 10,
                      borderTopWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    {suggestions.map(({ text, prompt, Icon }) => (
                      <Pressable
                        key={text}
                        accessibilityRole="button"
                        onPress={() => void send(prompt)}
                        style={({ pressed }) => [
                          styles.suggestion,
                          {
                            borderColor: colors.border,
                            backgroundColor: pressed
                              ? colors.mint
                              : "transparent",
                          },
                        ]}
                      >
                        <Icon size={16} color={colors.primary} />
                        <Label size={14} style={{ flex: 1 }}>
                          {text}
                        </Label>
                        <ArrowDownRight size={15} color={colors.secondary} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
              {turns.map((turn) => (
                <Animated.View
                  key={turn.id}
                  entering={reduced ? undefined : FadeIn.duration(180)}
                >
                  {turn.role === "user" ? (
                    <View style={styles.userTurn}>
                      <View
                        style={[
                          styles.userBubble,
                          { backgroundColor: colors.mint },
                        ]}
                      >
                        <Label size={15} selectable>
                          {turn.text}
                        </Label>
                      </View>
                      <MessageTime
                        createdAt={turn.createdAt}
                        color={colors.secondary}
                      />
                    </View>
                  ) : (
                    <View accessibilityLiveRegion="polite" style={{ gap: 10 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          gap: 7,
                          alignItems: "center",
                        }}
                      >
                        {turn.state === "saved" && (
                          <Check size={16} color={colors.success} />
                        )}
                        <Label
                          size={15}
                          selectable
                          style={{ flex: 1 }}
                          color={
                            turn.state === "error" ? colors.error : colors.text
                          }
                        >
                          {turn.reply.text}
                        </Label>
                      </View>
                      {turn.reply.title && (
                        <View
                          style={[
                            styles.summary,
                            {
                              backgroundColor: colors.background,
                              borderColor: colors.border,
                            },
                          ]}
                        >
                          <Heading size={16}>{turn.reply.title}</Heading>
                          {turn.reply.rows?.map((row, index) => (
                            <View
                              key={index}
                              style={[
                                styles.summaryRow,
                                { borderColor: colors.border },
                              ]}
                            >
                              <Label
                                size={13}
                                color={colors.secondary}
                                style={{ flex: 1 }}
                              >
                                {row.label}
                              </Label>
                              <Label
                                size={13}
                                bold
                                style={{ flex: 1.4, textAlign: "right" }}
                              >
                                {row.value}
                              </Label>
                            </View>
                          ))}
                        </View>
                      )}
                      {turn.reply.next && "route" in turn.reply.next && (
                        <Button
                          small
                          variant="secondary"
                          onPress={() => {
                            const next = turn.reply.next;
                            if (next && "route" in next) go(next.route);
                          }}
                        >
                          {turn.reply.next.label}
                        </Button>
                      )}
                      {turn.reply.next &&
                        "run" in turn.reply.next &&
                        pending === turn.id && (
                          <View style={styles.actions}>
                            <Button
                              small
                              variant={
                                turn.reply.next.danger ? "danger" : "primary"
                              }
                              onPress={() => {
                                const next = turn.reply.next;
                                if (next && "run" in next) void apply(next.run);
                              }}
                            >
                              {turn.reply.next.label}
                            </Button>
                            <Button
                              small
                              variant="ghost"
                              onPress={() => {
                                pendingAction.current = undefined;
                                followup.current = [];
                                setPending(null);
                              }}
                            >
                              Dismiss
                            </Button>
                          </View>
                        )}
                      <MessageTime
                        createdAt={turn.createdAt}
                        color={colors.secondary}
                      />
                    </View>
                  )}
                </Animated.View>
              ))}
              {busy && open && (
                <View
                  accessibilityLiveRegion="polite"
                  accessibilityLabel={
                    busy === "reply" ? "Preparing a reply" : "Saving changes"
                  }
                  testID="assistant-typing"
                  style={styles.typing}
                >
                  {[0, 120, 240].map((delay) => (
                    <TypingDot
                      key={delay}
                      delay={delay}
                      color={colors.primary}
                    />
                  ))}
                </View>
              )}
            </ScrollView>
            <View style={[styles.composer, { borderColor: colors.border }]}>
              <View
                style={[
                  styles.inputRow,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              >
                <TextInput
                  testID="assistant-input"
                  accessibilityLabel="Message Subloom assistant"
                  placeholder="Message Subloom…"
                  placeholderTextColor={colors.secondary}
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={() => void send(draft)}
                  returnKeyType="send"
                  maxLength={800}
                  style={[styles.input, { color: colors.text }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  disabled={!!busy || !draft.trim()}
                  accessibilityState={{ disabled: !!busy || !draft.trim() }}
                  onPress={() => void send(draft)}
                  style={({ pressed }) => [
                    styles.send,
                    {
                      backgroundColor: pressed
                        ? colors.pressed
                        : colors.primary,
                      opacity: busy || !draft.trim() ? 0.45 : 1,
                    },
                  ]}
                >
                  <ArrowUp size={19} color={colors.onPrimary} />
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  launcher: {
    position: "absolute",
    zIndex: 4,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    boxShadow: "0 5px 16px #102C2330",
  },
  panel: {
    overflow: "hidden",
    borderRadius: 23,
    elevation: 8,
    boxShadow: "0 12px 35px #102C2330",
  },
  header: {
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  thread: { padding: 20, gap: 24, flexGrow: 1 },
  empty: { paddingTop: 28, paddingBottom: 16, gap: 16 },
  suggestion: {
    minHeight: 52,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  userTurn: {
    alignSelf: "flex-end",
    maxWidth: "88%",
    alignItems: "flex-end",
    gap: 5,
  },
  userBubble: {
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 16,
    borderBottomRightRadius: 5,
  },
  summary: { padding: 12, borderWidth: 1, borderRadius: 13, gap: 5 },
  summaryRow: {
    paddingTop: 7,
    marginTop: 2,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  typing: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 13,
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  composer: {
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 13,
    gap: 6,
  },
  inputRow: {
    borderWidth: 1,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 4,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    fontFamily: tokens.fonts.body,
    fontSize: 15,
    paddingHorizontal: 11,
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
