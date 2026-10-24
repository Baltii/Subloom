import { canAddBillingMethod } from "../../domain/pro";
import { useProAccess } from "../../hooks/useProAccess";
import { useState } from "react";
import { View } from "react-native";
import * as Crypto from "expo-crypto";
import { Check } from "lucide-react-native";
import {
  cardBrands,
  walletProviders,
  type PaymentSource,
} from "../../domain/payments";
import {
  billingMethodDraftSchema,
  buildBillingMethod,
  type BillingMethodDraft,
} from "../../domain/billingMethods";
import { readableError } from "../../store/app";
import { useTheme } from "../../theme/useTheme";
import { Button, Chips, Field, Label } from "../ui/Primitives";
import { PickerSheet, SelectField } from "../ui/Selection";
import { PaymentMethodIcon } from "./PaymentMethodIcon";

export function BillingMethodEditor({
  initial,
  sources,
  onSave,
  onClose,
  needsReload,
  onReload,
}: {
  initial?: PaymentSource;
  sources: readonly PaymentSource[];
  onSave: (source: PaymentSource) => Promise<void>;
  onClose: () => void;
  needsReload: boolean;
  onReload: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const { requestPro } = useProAccess();
  const [draft, setDraft] = useState<BillingMethodDraft>({
    kind:
      initial?.kind === "wallet" ||
      (!initial &&
        sources.some((s) => s.kind === "card") &&
        !sources.some((s) => s.kind === "wallet"))
        ? "wallet"
        : "card",
    cardBrand: initial ? initial.cardBrand || "Other card" : "Visa",
    walletProvider: initial
      ? initial.walletProvider || "Other wallet"
      : "Apple Wallet",
    last4: initial?.last4 || "",
    nickname:
      initial && initial.name !== (initial.cardBrand || initial.walletProvider)
        ? initial.name
        : "",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [fieldErrors, setFieldErrors] = useState<
      Record<string, string | undefined>
    >({});
  function change<K extends keyof BillingMethodDraft>(
    key: K,
    value: BillingMethodDraft[K],
  ) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setFieldErrors((previous) => ({ ...previous, [key]: undefined }));
  }
  async function save() {
    const parsed = billingMethodDraftSchema.safeParse(draft);
    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path[0], issue.message]),
        ),
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const source = buildBillingMethod(
        parsed.data,
        initial?.id || Crypto.randomUUID(),
        new Date().toISOString(),
        initial,
      );
      if (
        !canAddBillingMethod(
          sources,
          [...sources.filter((s) => s.id !== source.id), source],
          false,
        ) &&
        !requestPro("More cards & wallets")
      ) {
        setError(
          "Free includes one card and one wallet. Your draft is still here.",
        );
        return;
      }
      await onSave(source);
      onClose();
    } catch (failure) {
      setError(readableError(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <PickerSheet
      visible
      title={initial ? "Edit billing method" : "Add billing method"}
      description="Save a label for tracking your subscriptions."
      busy={busy}
      onClose={onClose}
      footer={
        <Button
          icon={Check}
          loading={busy}
          disabled={busy || needsReload}
          onPress={() => void save()}
        >
          {initial ? "Save changes" : "Save billing method"}
        </Button>
      }
    >
      <View style={{ gap: 18 }}>
        <Chips
          values={["card", "wallet"] as const}
          labels={{ card: "Card", wallet: "Wallet" }}
          selected={draft.kind}
          onChange={(kind) => change("kind", kind)}
          disabled={busy || Boolean(initial)}
        />
        {draft.kind === "card" ? (
          <View>
            <SelectField
              label="Card type"
              testID="billing-card-brand"
              value={draft.cardBrand}
              onChange={(value) => change("cardBrand", value)}
              disabled={busy}
              options={cardBrands.map((value) => ({
                value,
                label: value,
                icon: (
                  <PaymentMethodIcon
                    size={24}
                    source={{ kind: "card", cardBrand: value }}
                  />
                ),
              }))}
            />
            <Field
              label="Last four digits"
              testID="billing-last4"
              value={draft.last4}
              onChangeText={(value) => change("last4", value)}
              placeholder="1234"
              keyboardType="number-pad"
              autoComplete="off"
              editable={!busy}
              error={fieldErrors.last4}
            />
          </View>
        ) : (
          <SelectField
            label="Wallet provider"
            testID="billing-wallet-provider"
            value={draft.walletProvider}
            onChange={(value) => change("walletProvider", value)}
            disabled={busy}
            options={walletProviders.map((value) => ({
              value,
              label: value,
              icon: (
                <PaymentMethodIcon
                  size={24}
                  source={{ kind: "wallet", walletProvider: value }}
                />
              ),
            }))}
          />
        )}
        <Field
          label="Nickname (optional)"
          testID="billing-nickname"
          value={draft.nickname}
          onChangeText={(value) => change("nickname", value)}
          placeholder={
            draft.kind === "card"
              ? "e.g. Everyday card"
              : "e.g. Personal wallet"
          }
          autoComplete="off"
          editable={!busy}
          error={fieldErrors.nickname}
        />
        <Label size={12} color={colors.secondary}>
          {draft.kind === "card"
            ? "Only the card type and last four digits are needed. Keep your full card number and security code private."
            : "Only the provider and an optional nickname are needed. No account access or wallet address is required."}
        </Label>
        {error && (
          <Label color={colors.error} accessibilityRole="alert">
            {error}
          </Label>
        )}
        {needsReload && (
          <View style={{ gap: 8 }}>
            <Label size={12} color={colors.secondary}>
              Reload your billing methods before saving. Your input will stay
              here.
            </Label>
            <Button small variant="secondary" onPress={() => void onReload()}>
              Reload billing methods
            </Button>
          </View>
        )}
      </View>
    </PickerSheet>
  );
}
