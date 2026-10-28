import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as Crypto from "expo-crypto";
import {
  Bug,
  Check,
  Lightbulb,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
} from "lucide-react-native";
import { useReducedMotion } from "react-native-reanimated";
import {
  Button,
  Card,
  Field,
  Heading,
  Label,
  Page,
} from "../components/ui/Primitives";
import {
  feedbackDraftSchema,
  feedbackTitle,
  type FeedbackDraft,
} from "../domain/feedback";
import { sendFeedback } from "../services/feedback";
import { backendConfigured } from "../services/supabase";
import { readableError, useApp } from "../store/app";
import { useDraftGuard } from "../hooks/useDraftGuard";
import { useTheme } from "../theme/useTheme";

const topics = [
  {
    value: "idea",
    label: "An idea",
    icon: Lightbulb,
    placeholder: "I wish Subloom could…",
    action: "Send my idea",
  },
  {
    value: "problem",
    label: "A problem",
    icon: Bug,
    placeholder: "I was trying to… but then…",
    action: "Share the problem",
  },
  {
    value: "feedback",
    label: "Just a thought",
    icon: MessageCircle,
    placeholder: "Something I’ve noticed…",
    action: "Share my thought",
  },
] as const;

function Conversation({ sent = false }: { sent?: boolean }) {
  const reduced = useReducedMotion();
  const [arrival] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    arrival.setValue(reduced ? 1 : 0);
    if (reduced) return;
    const animation = Animated.timing(arrival, {
      toValue: 1,
      duration: sent ? 650 : 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [arrival, reduced, sent]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        opacity: arrival.interpolate({
          inputRange: [0, 1],
          outputRange: [0.65, 1],
        }),
        transform: [
          {
            translateY: arrival.interpolate({
              inputRange: [0, 1],
              outputRange: [sent ? 22 : 10, 0],
            }),
          },
          {
            rotate: arrival.interpolate({
              inputRange: [0, 1],
              outputRange: [sent ? "-7deg" : "-3deg", "0deg"],
            }),
          },
        ],
      }}
    >
      <Image
        source={require("../../assets/illustrations/feedback-conversation.webp")}
        contentFit="contain"
        style={{ width: sent ? 160 : 126, height: sent ? 140 : 118 }}
      />
    </Animated.View>
  );
}
export default function FeedbackRoute() {
  const identity = useApp((state) => state.identity);
  return <FeedbackForm key={identity} />;
}
function FeedbackForm() {
  const { colors } = useTheme();
  const [kind, setKind] = useState<FeedbackDraft["kind"]>("idea");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<
    Partial<Record<keyof FeedbackDraft, string>>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const requestId = useRef<string | null>(null);
  const running = useRef(false);
  const draft = useDraftGuard(!sent && Boolean(message || email), busy);
  const selected = topics.find((topic) => topic.value === kind)!;
  useEffect(() => {
    if (sent)
      AccessibilityInfo.announceForAccessibility(
        "Your thought has landed. Thanks for helping Subloom grow.",
      );
  }, [sent]);
  function edited() {
    requestId.current = null;
    setError(null);
    setErrors({});
  }
  async function submit() {
    if (running.current) return;
    const parsed = feedbackDraftSchema.safeParse({
      kind,
      title: feedbackTitle(message),
      message,
      replyEmail: email.trim() || null,
    });
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({
        message: fields.message?.[0],
        replyEmail: fields.replyEmail?.[0],
      });
      return;
    }
    running.current = true;
    requestId.current ??= Crypto.randomUUID();
    setBusy(true);
    setError(null);
    try {
      await sendFeedback(parsed.data, requestId.current);
      setSent(true);
    } catch (e) {
      setError(readableError(e));
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <Page title="Ideas & feedback" back contentMaxWidth={850}>
      {sent ? (
        <Card style={{ gap: 16, alignItems: "center", paddingVertical: 30 }}>
          <Conversation sent />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Check size={22} color={colors.primary} />
            <Heading size={24}>Your thought has landed.</Heading>
          </View>
          <Label style={{ textAlign: "center", maxWidth: 470 }}>
            Thanks for helping Subloom grow. Your message is on its way to my
            inbox.
          </Label>
          {email.trim() ? (
            <Label
              size={13}
              color={colors.secondary}
              style={{ textAlign: "center" }}
            >
              You left an email, so I can get back to you there.
            </Label>
          ) : null}
          <Button
            variant="secondary"
            icon={MessageCircle}
            onPress={() => {
              setMessage("");
              setEmail("");
              setKind("idea");
              edited();
              setSent(false);
            }}
          >
            Share another thought
          </Button>
        </Card>
      ) : (
        <View style={{ gap: 20 }}>
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            <View style={{ flex: 1, gap: 8 }}>
              <Heading size={23}>What’s on your mind?</Heading>
            </View>
            <Conversation />
          </View>
          <Card style={{ gap: 18 }}>
            <View
              accessibilityLabel="What would you like to share?"
              style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
            >
              {topics.map(({ value, label, icon: Icon }) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  {...(Platform.OS === "web"
                    ? { "aria-pressed": kind === value }
                    : {})}
                  accessibilityState={{
                    ...(Platform.OS !== "web"
                      ? { selected: kind === value }
                      : {}),
                    disabled: busy,
                  }}
                  disabled={busy}
                  onPress={() => {
                    edited();
                    setKind(value);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 7,
                    minHeight: 46,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor:
                      kind === value
                        ? colors.primary
                        : pressed
                          ? colors.mint
                          : colors.background,
                    opacity: busy ? 0.6 : 1,
                  })}
                >
                  <Icon
                    size={17}
                    color={kind === value ? colors.onPrimary : colors.secondary}
                  />
                  <Label
                    size={13}
                    bold
                    color={kind === value ? colors.onPrimary : colors.text}
                  >
                    {label}
                  </Label>
                </Pressable>
              ))}
            </View>
            <Field
              label={kind === "problem" ? "What happened?" : "Your thought"}
              placeholder={selected.placeholder}
              value={message}
              maxLength={4000}
              multiline
              textAlignVertical="top"
              style={{ minHeight: 145 }}
              error={errors.message}
              editable={!busy}
              onChangeText={(value) => {
                edited();
                setMessage(value);
              }}
              hint={
                message.length > 3600
                  ? `${message.length} / 4000 characters`
                  : undefined
              }
            />
            <Field
              label="Your email (only if you’d like a reply)"
              placeholder="you@example.com"
              leading={<Mail size={17} color={colors.secondary} />}
              value={email}
              maxLength={254}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              error={errors.replyEmail}
              editable={!busy}
              onChangeText={(value) => {
                edited();
                setEmail(value);
              }}
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 8,
                marginBottom: 18,
              }}
            >
              <ShieldCheck size={17} color={colors.secondary} />
              <Label size={12} color={colors.secondary} style={{ flex: 1 }}>
                Private, straight to Ahmed’s inbox. App version and platform are
                included to help me understand.
              </Label>
            </View>
            {!backendConfigured ? (
              <Label color={colors.error} style={{ marginBottom: 12 }}>
                Feedback is unavailable right now. Please try again later.
              </Label>
            ) : null}
            {error ? (
              <Label
                color={colors.error}
                accessibilityLiveRegion="polite"
                style={{ marginBottom: 12 }}
              >
                {error} Your message is still here.
              </Label>
            ) : null}
            <Button
              icon={Send}
              loading={busy}
              disabled={!backendConfigured}
              onPress={() => void submit()}
              testID="send-feedback"
            >
              {busy ? "Sending your thought…" : selected.action}
            </Button>
          </Card>
        </View>
      )}
      {draft.confirmation}
    </Page>
  );
}
