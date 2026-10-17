import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { Button, Field, Label, Page } from "../../components/ui/Primitives";
import { SelectField } from "../../components/ui/Selection";
import { useApp, notify, readableError } from "../../store/app";
import { useDraftGuard } from "../../hooks/useDraftGuard";
import { useFeatureSetting } from "../../hooks/useFeatureSetting";
import {
  emptyPaymentProfile,
  paymentProfileSchema,
  paymentSourceSchema,
  type PaymentSource,
} from "../../domain/payments";
import { PaymentSettingState } from "../../components/payments/PaymentSettingState";
const kinds = [
  { value: "card", label: "Card" },
  { value: "bank", label: "Bank account" },
  { value: "wallet", label: "Wallet" },
] as const;
function Editor({ id }: { id?: string }) {
  const profile = useFeatureSetting(
      "payment_sources",
      paymentProfileSchema,
      emptyPaymentProfile,
    ),
    demo = useApp((s) => s.data.demo);
  const [kind, setKind] = useState<PaymentSource["kind"]>("card"),
    [name, setName] = useState(""),
    [last4, setLast4] = useState(""),
    [month, setMonth] = useState(""),
    [year, setYear] = useState(""),
    [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const draft = useDraftGuard(dirty, profile.busy);
  const initialized = useRef(false);
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive || initialized.current || !profile.loaded) return;
      const source = profile.value.sources.find((s) => s.id === id);
      if (source) {
        setKind(source.kind);
        setName(source.name);
        setLast4(source.last4 ?? "");
        setMonth(source.expiryMonth?.toString() ?? "");
        setYear(source.expiryYear?.toString() ?? "");
      }
      initialized.current = true;
    });
    return () => {
      alive = false;
    };
  }, [profile.loaded, profile.value, id]);
  const missing = Boolean(
    id && profile.loaded && !profile.value.sources.some((s) => s.id === id),
  );
  async function save() {
    setError(null);
    try {
      const source = paymentSourceSchema.parse({
        id: id ?? Crypto.randomUUID(),
        kind,
        name,
        last4: kind === "card" && last4 ? last4 : null,
        expiryMonth: kind === "card" && month ? Number(month) : null,
        expiryYear: kind === "card" && year ? Number(year) : null,
        updatedAt: new Date().toISOString(),
      });
      const previous = profile.value.sources.find((s) => s.id === id);
      const changedDetails =
        previous &&
        (previous.kind !== source.kind ||
          previous.last4 !== source.last4 ||
          previous.expiryMonth !== source.expiryMonth ||
          previous.expiryYear !== source.expiryYear);
      if (previous && !changedDetails) source.updatedAt = previous.updatedAt;
      await profile.save({
        ...profile.value,
        sources: [
          source,
          ...profile.value.sources.filter((s) => s.id !== source.id),
        ],
      });
      draft.saved();
      notify("Payment source saved.");
      router.replace({
        pathname: "/payments/source",
        params: { id: source.id },
      });
    } catch (e) {
      setError(readableError(e));
    }
  }
  return (
    <Page
      title={id ? "Edit payment source" : "Add payment source"}
      subtitle="Keep a recognizable nickname and the details needed for renewal planning."
      back
      footer={
        <Button
          loading={profile.busy}
          disabled={!profile.loaded || demo || missing}
          onPress={() => void save()}
        >
          Save payment source
        </Button>
      }
    >
      <PaymentSettingState
        loaded={profile.loaded}
        error={profile.error}
        reload={profile.reload}
      />
      {missing ? (
        <Label accessibilityRole="alert">
          This payment source is no longer available. Return to Cards & wallets.
        </Label>
      ) : null}
      <View style={{ gap: 10 }}>
        <SelectField
          label="Payment source type"
          value={kind}
          options={kinds}
          onChange={(value) => {
            setDirty(true);
            setKind(value);
          }}
          disabled={profile.busy}
        />
        <Field
          label="Nickname"
          placeholder="Everyday card"
          maxLength={60}
          value={name}
          onChangeText={(value) => {
            setDirty(true);
            setName(value);
          }}
          editable={!profile.busy}
        />
        {kind === "card" ? (
          <>
            <Field
              label="Last four digits (optional)"
              maxLength={4}
              keyboardType="number-pad"
              value={last4}
              onChangeText={(value) => {
                setDirty(true);
                setLast4(value);
              }}
              editable={!profile.busy}
            />
            <View style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Expiry month (optional)"
                  maxLength={2}
                  keyboardType="number-pad"
                  value={month}
                  onChangeText={(value) => {
                    setDirty(true);
                    setMonth(value);
                  }}
                  editable={!profile.busy}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Expiry year (optional)"
                  maxLength={4}
                  keyboardType="number-pad"
                  placeholder="2028"
                  value={year}
                  onChangeText={(value) => {
                    setDirty(true);
                    setYear(value);
                  }}
                  editable={!profile.busy}
                />
              </View>
            </View>
            <Label size={13}>
              Use only the last four digits. Full card numbers, security codes,
              and banking passwords are not needed.
            </Label>
          </>
        ) : null}
        {id ? (
          <Label size={13}>
            Changing card details creates a review checklist for its linked
            subscriptions. Update the details with each billing provider
            separately.
          </Label>
        ) : null}
        {error ? <Label accessibilityRole="alert">{error}</Label> : null}
      </View>
      {draft.confirmation}
    </Page>
  );
}
export default function PaymentEditor() {
  const identity = useApp((s) => s.identity),
    params = useLocalSearchParams<{ id?: string }>();
  return (
    <Editor
      key={identity + (params.id ?? "new")}
      id={typeof params.id === "string" ? params.id : undefined}
    />
  );
}
