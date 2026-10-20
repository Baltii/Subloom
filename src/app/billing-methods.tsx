import { useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { CreditCard, Plus } from "lucide-react-native";
import { useApp, notify, readableError } from "../store/app";
import { useBillingMethods } from "../hooks/useBillingMethods";
import {
  billingMethodLabel,
  billingReference,
  billingSource,
} from "../domain/billingMethods";
import { removePaymentSource, type PaymentSource } from "../domain/payments";
import { SavedBillingMethods } from "../components/payments/SavedBillingMethods";
import { BillingMethodEditor } from "../components/payments/BillingMethodEditor";
import {
  Button,
  Card,
  Confirm,
  Empty,
  Label,
  Page,
} from "../components/ui/Primitives";
import { useTheme, useWide } from "../theme/useTheme";

export default function BillingMethodsRoute() {
  const identity = useApp((state) => state.identity);
  return <BillingMethods key={identity} />;
}
function BillingMethods() {
  const { colors } = useTheme(),
    wide = useWide(),
    methods = useBillingMethods(),
    data = useApp((state) => state.data),
    identity = useApp((state) => state.identity);
  const [editing, setEditing] = useState<PaymentSource | "new" | null>(null),
    [removing, setRemoving] = useState<PaymentSource | null>(null),
    [error, setError] = useState<string | null>(null);
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const subscription of data.subscriptions) {
      const source = billingSource(subscription, methods.value);
      if (source) result.set(source.id, (result.get(source.id) || 0) + 1);
    }
    return result;
  }, [data.subscriptions, methods.value]);
  const disabled = !methods.loaded || methods.busy || data.demo;
  return (
    <Page
      title="Cards & wallets"
      subtitle="Know what pays for each subscription."
      back
      contentMaxWidth={1076}
      right={
        <Button
          small
          icon={Plus}
          disabled={disabled || methods.value.sources.length >= 50}
          onPress={() => setEditing("new")}
        >
          {wide ? "Add method" : "Add"}
        </Button>
      }
    >
      <View
        style={{ width: "100%", maxWidth: 1000, alignSelf: "center", gap: 20 }}
      >
        <Label color={colors.secondary} size={13}>
          Save cards and wallets, then assign them to your subscriptions.
        </Label>
        {data.demo && (
          <Label size={13} color={colors.secondary}>
            Leave the sample workspace to save your own cards and wallets.
          </Label>
        )}
        {identity !== "guest" && (
          <Label size={12} color={colors.secondary}>
            Cards and wallets sync with your account. Connect to load or change
            them.
          </Label>
        )}
        {methods.error && (
          <Card>
            <Label accessibilityRole="alert" color={colors.error}>
              {methods.error}
            </Label>
            <Button
              small
              variant="secondary"
              onPress={() => void methods.reload()}
            >
              Try again
            </Button>
          </Card>
        )}
        {!methods.loaded && !methods.error && (
          <Label color={colors.secondary}>Loading billing methods…</Label>
        )}
        {methods.loaded && !methods.value.sources.length && (
          <Empty
            icon={CreditCard}
            title="Your billing methods, together."
            body="Add a card or wallet, then choose it on a subscription. Only simple labels are saved."
          />
        )}
        {methods.loaded && (
          <SavedBillingMethods
            sources={methods.value.sources}
            counts={counts}
            disabled={disabled}
            onEdit={setEditing}
            onRemove={setRemoving}
            onView={(source) =>
              router.push({
                pathname: "/subscriptions",
                params: { billing: billingReference(source.id) },
              })
            }
          />
        )}
        {methods.value.sources.length >= 50 && (
          <Label size={13} color={colors.secondary}>
            You can save up to 50 billing methods. Edit or remove an existing
            method to make room.
          </Label>
        )}
        {error && (
          <Label accessibilityRole="alert" color={colors.error}>
            {error}
          </Label>
        )}
        <Label size={12} color={colors.secondary}>
          These records help you track billing. Changes here do not update
          payment details at your subscription provider.
        </Label>
      </View>
      {editing && (
        <BillingMethodEditor
          key={editing === "new" ? "new" : editing.id}
          initial={editing === "new" ? undefined : editing}
          needsReload={!methods.loaded}
          onReload={methods.reload}
          onClose={() => setEditing(null)}
          onSave={async (source) => {
            if (editing !== "new" && !methods.byId.has(source.id))
              throw new Error(
                "This method was removed. Close this form and add a new method.",
              );
            await methods.save({
              ...methods.value,
              sources: [
                ...methods.value.sources.filter(
                  (item) => item.id !== source.id,
                ),
                source,
              ],
            });
            notify("Billing method saved.");
          }}
        />
      )}
      <Confirm
        visible={Boolean(removing)}
        title="Remove billing method?"
        action="Remove method"
        danger
        onClose={() => setRemoving(null)}
        body={
          removing
            ? `Remove ${billingMethodLabel(removing)} from Subloom? ${counts.get(removing.id) || 0} linked subscriptions will need a new billing method. This does not change provider billing.`
            : ""
        }
        onConfirm={async () => {
          if (!removing) return;
          try {
            await methods.save(removePaymentSource(methods.value, removing.id));
            setRemoving(null);
            setError(null);
            notify("Billing method removed.");
          } catch (failure) {
            setError(readableError(failure));
            throw failure;
          }
        }}
      />
    </Page>
  );
}
