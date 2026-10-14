import { useMemo, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  Button,
  Field,
  Heading,
  Label,
  Page,
} from "../../components/ui/Primitives";
import { SelectField } from "../../components/ui/Selection";
import { useFeatureSetting } from "../../hooks/useFeatureSetting";
import { useDraftGuard } from "../../hooks/useDraftGuard";
import { useApp, notify, readableError } from "../../store/app";
import {
  emptyLedger,
  ledgerSchema,
  statementExample,
  statementHeaders,
  defaultMapping,
  parseStatement,
  statementFingerprintInput,
  mergeStatement,
  type StatementMapping,
  type PaymentTransaction,
} from "../../domain/radar";
import {
  emptyPaymentProfile,
  paymentProfileSchema,
  currencyOptions,
} from "../../domain/payments";
import { type Currency } from "../../domain/models";
import { formatMoney } from "../../domain/money";
import { chooseStatementCsv } from "../../services/statementImport";
import { shareText } from "../../services/files";
import { PaymentSettingState } from "../../components/payments/PaymentSettingState";
function Importer() {
  const ledger = useFeatureSetting(
      "payment_transactions",
      ledgerSchema,
      emptyLedger,
    ),
    profile = useFeatureSetting(
      "payment_sources",
      paymentProfileSchema,
      emptyPaymentProfile,
    );
  const identity = useApp((s) => s.identity),
    preferences = useApp((s) => s.data.preferences),
    demo = useApp((s) => s.data.demo);
  const [text, setText] = useState(""),
    [headers, setHeaders] = useState<string[]>([]),
    [mapping, setMapping] = useState<StatementMapping | null>(null),
    [currency, setCurrency] = useState<Currency>(preferences.currency),
    [sign, setSign] = useState<"negative" | "positive">("negative"),
    [source, setSource] = useState(""),
    [preview, setPreview] = useState<PaymentTransaction[] | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [visible, setVisible] = useState(30);
  const savedFingerprints = useMemo(
    () => new Set(ledger.value.map((t) => t.fingerprint)),
    [ledger.value],
  );
  const draft = useDraftGuard(Boolean(text), busy || ledger.busy);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  function updateText(value: string) {
    setText(value);
    setHeaders([]);
    setMapping(null);
    setPreview(null);
    setError(null);
  }
  function columns() {
    setError(null);
    try {
      const h = statementHeaders(text);
      setHeaders(h);
      setMapping(defaultMapping(h));
      setPreview(null);
    } catch (e) {
      setError(readableError(e));
    }
  }
  const options = headers.map((label, index) => ({
    value: String(index),
    label,
  }));
  const ready = ledger.loaded && profile.loaded && !demo && !busy;
  async function review() {
    if (!mapping) return;
    const rows = parseStatement(
      text,
      mapping,
      currency,
      sign === "negative",
      source || null,
    );
    const now = new Date().toISOString();
    const values = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        id: Crypto.randomUUID(),
        fingerprint: await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          statementFingerprintInput(row),
        ),
        subscriptionId: null,
        ignored: false,
        importedAt: now,
      })),
    );
    if (useApp.getState().identity !== identity)
      throw new Error("Your account changed. Reopen the import.");
    mergeStatement(ledger.value, values);
    setPreview(values);
    setVisible(30);
  }
  return (
    <Page
      title="Import a statement"
      subtitle="Map your CSV columns, check charges and refunds, then import the reviewed rows."
      back
      footer={
        preview ? (
          <Button
            loading={busy || ledger.busy}
            disabled={!ready || !preview.length}
            onPress={() =>
              void run(async () => {
                const result = mergeStatement(ledger.value, preview);
                await ledger.save(result.value);
                draft.saved();
                setText("");
                notify(
                  `${result.added} transactions imported; ${result.skipped} exact repeats skipped.`,
                );
                router.replace("/payments/radar");
              })
            }
          >
            Import reviewed transactions
          </Button>
        ) : undefined
      }
    >
      <View style={{ gap: 20 }}>
        <PaymentSettingState
          loaded={ledger.loaded}
          error={ledger.error}
          reload={ledger.reload}
        />
        <PaymentSettingState
          loaded={profile.loaded}
          error={profile.error}
          reload={profile.reload}
        />
        <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            loading={busy}
            onPress={() =>
              void run(async () => {
                const value = await chooseStatementCsv();
                if (value !== null) updateText(value);
              })
            }
          >
            Choose statement CSV
          </Button>
          <Button
            variant="ghost"
            onPress={() =>
              void run(() =>
                shareText(
                  statementExample,
                  "subloom-statement-example.csv",
                  "text/csv",
                ),
              )
            }
          >
            Download example CSV
          </Button>
        </View>
        <Field
          label="Statement CSV"
          multiline
          numberOfLines={7}
          value={text}
          maxLength={2_000_000}
          editable={!busy && !ledger.busy}
          onChangeText={updateText}
        />
        <Label size={13}>
          Use ISO dates (YYYY-MM-DD) and plain decimal amounts. Only mapped
          transaction details are saved; the original file stays on your device.
        </Label>
        <Button disabled={!text.trim() || busy} onPress={columns}>
          Map columns
        </Button>
        {mapping ? (
          <View style={{ gap: 12 }}>
            <Heading size={22}>Which columns should we read?</Heading>
            {(
              ["date", "merchant", "amount", "currency", "reference"] as const
            ).map((key) => (
              <SelectField
                key={key}
                label={
                  key === "date"
                    ? "Posted date column"
                    : key === "merchant"
                      ? "Merchant column"
                      : key === "amount"
                        ? "Amount column"
                        : key === "currency"
                          ? "Currency column"
                          : "Reference column"
                }
                value={mapping[key] === null ? "none" : String(mapping[key])}
                options={
                  key === "currency" || key === "reference"
                    ? [
                        {
                          value: "none",
                          label:
                            key === "currency"
                              ? "Use selected currency"
                              : "No reference column",
                        },
                        ...options,
                      ]
                    : options
                }
                onChange={(value) => {
                  setMapping({
                    ...mapping,
                    [key]: value === "none" ? null : Number(value),
                  });
                  setPreview(null);
                }}
                disabled={busy}
              />
            ))}
          </View>
        ) : null}
        <SelectField
          label="Default currency"
          value={currency}
          options={currencyOptions}
          onChange={(value) => {
            setCurrency(value);
            setPreview(null);
          }}
          disabled={busy}
        />
        <SelectField
          label="Charge amount convention"
          value={sign}
          options={[
            {
              value: "negative",
              label: "Negative amounts are charges",
              detail: "Positive amounts are refunds or credits",
            },
            {
              value: "positive",
              label: "Positive amounts are charges",
              detail: "Negative amounts are refunds or credits",
            },
          ]}
          onChange={(value) => {
            setSign(value);
            setPreview(null);
          }}
          disabled={busy}
        />
        <SelectField
          label="Payment source for this statement"
          value={source || "none"}
          options={[
            { value: "none", label: "Unassigned" },
            ...profile.value.sources.map((s) => ({
              value: s.id,
              label: s.name,
            })),
          ]}
          onChange={(value) => {
            setSource(value === "none" ? "" : value);
            setPreview(null);
          }}
          disabled={!profile.loaded || busy}
        />
        {mapping ? (
          <Button
            loading={busy}
            disabled={!ready}
            onPress={() => void run(review)}
          >
            Review transaction rows
          </Button>
        ) : null}
        {preview ? (
          <View style={{ gap: 12 }}>
            <Heading size={22}>{preview.length} rows to review</Heading>
            <Label>
              {
                preview.filter((t) => !savedFingerprints.has(t.fingerprint))
                  .length
              }{" "}
              new rows. Check the sign convention before importing. Exact
              repeats are skipped.
            </Label>
            {preview.slice(0, visible).map((t) => (
              <View key={t.id} style={{ gap: 4, paddingVertical: 10 }}>
                <Label bold>{t.merchant}</Label>
                <Label>
                  {t.date} ·{" "}
                  {t.direction === "debit" ? "Charge" : "Refund / credit"} ·{" "}
                  {formatMoney(t.amountMinor, t.currency)} {t.currency}
                </Label>
                <Label size={12}>
                  {t.reference || "No reference supplied"}
                </Label>
              </View>
            ))}
            {preview.length > visible ? (
              <Button variant="ghost" onPress={() => setVisible((v) => v + 30)}>
                Show more review rows
              </Button>
            ) : null}
          </View>
        ) : null}
        <Label size={13}>
          Up to 300 saved transactions, across all imports. Matching and
          recurring detection are suggestions based on imported statements; no
          bank is connected.
        </Label>
        {error ? <Label accessibilityRole="alert">{error}</Label> : null}
      </View>
      {draft.confirmation}
    </Page>
  );
}
export default function StatementImport() {
  const identity = useApp((s) => s.identity);
  return <Importer key={identity} />;
}
