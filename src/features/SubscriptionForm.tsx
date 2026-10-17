import { useEffect, useRef, useState } from "react";
import { View, Platform } from "react-native";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router, useNavigation } from "expo-router";
import {
  usePreventRemove,
  type NavigationAction,
} from "expo-router/react-navigation";
import * as Crypto from "expo-crypto";
import { Check, ChevronDown, ChevronUp, Search } from "lucide-react-native";
import {
  categories,
  currencies,
  dateSchema,
  intervals,
  type Candidate,
  type Subscription,
} from "../domain/models";
import { catalog } from "../domain/catalog";
import { moneyInput, parseMoney } from "../domain/money";
import { quickAddDates } from "../domain/calendarEvents";
import { today } from "../domain/renewal";
import { saveSubscription, readableError, useApp } from "../store/app";
import {
  Badge,
  Button,
  Card,
  Chips,
  Field,
  Label,
  Confirm,
  Page,
} from "../components/ui/Primitives";
import { DateField } from "../components/ui/DateField";
import { PickerSheet, SelectField } from "../components/ui/Selection";
import {
  currencyOptions,
  categoryOptions,
  intervalOptions,
} from "../components/ui/pickerOptions";
import { ServicePicker } from "../components/subscriptions/ServicePicker";
import { useTheme, useWide } from "../theme/useTheme";
const formSchema = z
  .object({
    name: z.string().trim().min(1, "Give your subscription a name.").max(80),
    amount: z.string().min(1, "Enter the price you actually pay."),
    currency: z
      .enum([...currencies, ""])
      .refine((v) => v !== "", "Choose the receipt’s currency."),
    category: z.enum(categories),
    interval: z
      .enum([...intervals, ""])
      .refine((v) => v !== "", "Choose the billing frequency."),
    intervalCount: z
      .string()
      .regex(/^[1-9]\d{0,2}$/, "Enter a whole number between 1 and 365.")
      .refine((v) => Number(v) <= 365),
    customUnit: z.enum(["day", "week", "month", "year"]),
    nextRenewal: dateSchema,
    startDate: dateSchema,
    status: z.enum(["active", "trial", "paused", "canceled", "expired"]),
    trialEnd: z.string(),
    paymentMethod: z.string().max(80),
    notes: z.string().max(2000),
  })
  .superRefine((values, context) => {
    try {
      if (values.currency) parseMoney(values.amount, values.currency);
    } catch (e) {
      context.addIssue({
        code: "custom",
        path: ["amount"],
        message: readableError(e),
      });
    }
    if (
      values.status === "trial" &&
      !dateSchema.safeParse(values.trialEnd).success
    )
      context.addIssue({
        code: "custom",
        path: ["trialEnd"],
        message: "Enter the date your trial ends.",
      });
  });
type Values = z.input<typeof formSchema>;
export function SubscriptionForm({
  initial,
  candidate,
  defaultRenewalDate,
  page,
}: {
  initial?: Subscription;
  candidate?: Candidate;
  defaultRenewalDate?: string;
  page?: { title: string; subtitle?: string };
}) {
  const navigation = useNavigation();
  const { colors } = useTheme(),
    wide = useWide(),
    preferences = useApp((s) => s.data.preferences),
    identity = useApp((s) => s.identity);
  const formIdentity = useRef(identity);
  const dateDefaults = quickAddDates(
    defaultRenewalDate,
    today(preferences.timezone),
  );
  const [serviceId, setServiceId] = useState(
      initial?.serviceId || candidate?.serviceId || null,
    ),
    [error, setError] = useState<string | null>(null),
    [advanced, setAdvanced] = useState(false),
    [choosingService, setChoosingService] = useState(false),
    [pendingNavigation, setPendingNavigation] =
      useState<NavigationAction | null>(null),
    [busy, setBusy] = useState(false);
  const currency =
    initial?.currency ||
    candidate?.currency ||
    (candidate ? "" : preferences.currency);
  const {
    control,
    setValue,
    handleSubmit,
    setFocus,
    formState: { errors, isDirty },
  } = useForm<Values, unknown, z.output<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initial?.name || candidate?.merchant || "",
      amount: initial
        ? moneyInput(initial.amountMinor, initial.currency)
        : candidate?.amountMinor !== null &&
            candidate?.amountMinor !== undefined &&
            candidate.currency
          ? moneyInput(candidate.amountMinor, candidate.currency)
          : "",
      currency,
      category:
        initial?.category ||
        catalog.find((s) => s.id === candidate?.serviceId)?.category ||
        "Other",
      interval:
        initial?.interval ||
        candidate?.interval ||
        (candidate ? "" : "monthly"),
      intervalCount: String(initial?.intervalCount || 1),
      customUnit: initial?.customUnit || "day",
      nextRenewal:
        initial?.nextRenewal ||
        candidate?.nextRenewal ||
        (candidate ? "" : dateDefaults.nextRenewal),
      startDate:
        initial?.startDate ||
        candidate?.chargeDate ||
        (candidate ? today(preferences.timezone) : dateDefaults.startDate),
      trialEnd: initial?.trialEnd || candidate?.trialEnd || "",
      status: initial?.status || (candidate?.trialEnd ? "trial" : "active"),
      paymentMethod: initial?.paymentMethod || "",
      notes: initial?.notes || "",
    },
  });
  const saved = useRef(false);
  usePreventRemove(isDirty, ({ data }) => {
    if (saved.current) navigation.dispatch(data.action);
    else setPendingNavigation(data.action);
  });
  useEffect(() => {
    if (Platform.OS !== "web" || !isDirty) return;
    function protectDraft(event: BeforeUnloadEvent) {
      if (!saved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [isDirty]);
  const interval = useWatch({ control, name: "interval" }),
    status = useWatch({ control, name: "status" }),
    chosenCurrency = useWatch({ control, name: "currency" });
  function field(
    name: keyof Values,
    label: string,
    extra: import("react-native").TextInputProps = {},
  ) {
    return (
      <Controller
        control={control}
        name={name}
        render={({ field: f }) => (
          <Field
            testID={"subscription-" + name}
            label={label}
            value={f.value}
            onChangeText={f.onChange}
            onBlur={f.onBlur}
            inputRef={f.ref}
            error={errors[name]?.message}
            editable={!busy}
            {...extra}
          />
        )}
      />
    );
  }
  function dateField(
    name: "nextRenewal" | "startDate" | "trialEnd",
    label: string,
  ) {
    return (
      <Controller
        control={control}
        name={name}
        render={({ field: f }) => (
          <DateField
            testID={"subscription-" + name}
            label={label}
            disabled={busy}
            value={f.value}
            onChange={f.onChange}
            onBlur={f.onBlur}
            inputRef={f.ref}
            error={errors[name]?.message}
          />
        )}
      />
    );
  }
  async function submit(values: z.output<typeof formSchema>) {
    setBusy(true);
    setError(null);
    try {
      if (
        useApp.getState().identity !== formIdentity.current ||
        !useApp.getState().hydrated
      )
        throw new Error("Your account changed. Reopen the form before saving.");
      if (!values.currency || !values.interval)
        throw new Error("Confirm the currency and billing frequency.");
      const now = new Date().toISOString(),
        id = initial?.id || Crypto.randomUUID();
      const subscription: Subscription = {
        id,
        userId: useApp.getState().identity,
        serviceId,
        name: values.name,
        category: values.category,
        amountMinor: parseMoney(values.amount, values.currency),
        currency: values.currency,
        interval: values.interval,
        intervalCount: Number(values.intervalCount),
        customUnit: values.customUnit,
        startDate: values.startDate,
        nextRenewal: values.nextRenewal,
        anchorDay:
          initial && initial.nextRenewal === values.nextRenewal
            ? initial.anchorDay
            : Number(values.nextRenewal.slice(-2)),
        status: values.status,
        trialEnd: values.status === "trial" ? values.trialEnd : null,
        canceledAt: initial?.canceledAt || null,
        paidThrough: initial?.paidThrough || null,
        paymentMethod: values.paymentMethod,
        notes: values.notes,
        source: initial?.source || candidate?.source || "manual",
        reminders: initial?.reminders || null,
        createdAt: initial?.createdAt || now,
        updatedAt: now,
        version: initial?.version || 0,
      };
      await saveSubscription(subscription, candidate?.id);
      saved.current = true;
      router.replace({ pathname: "/subscription/[id]", params: { id } });
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  const saveBar = (
    <View style={{ width: "100%", maxWidth: 780, alignSelf: "center", gap: 8 }}>
      <Button
        testID="save-subscription"
        icon={Check}
        loading={busy}
        disabled={busy}
        onPress={() =>
          void handleSubmit(submit, () => {
            setError("Check the highlighted fields before saving.");
            setAdvanced(true);
          })()
        }
      >
        {candidate
          ? initial
            ? "Confirm update"
            : "Confirm subscription"
          : initial
            ? "Save changes"
            : "Add subscription"}
      </Button>
      <Label size={12} color={colors.secondary} style={{ textAlign: "center" }}>
        {identity === "guest"
          ? "Saves on this device"
          : "Saves locally and queues secure sync"}
      </Label>
    </View>
  );
  const content = (
    <View style={{ maxWidth: 780, width: "100%", alignSelf: "center" }}>
      <Card style={{ padding: wide ? 30 : 20 }}>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 18,
          }}
        >
          {!candidate && (
            <Button
              icon={Search}
              variant="secondary"
              small
              disabled={busy}
              onPress={() => {
                setChoosingService(true);
              }}
            >
              Choose a service
            </Button>
          )}
          {isDirty && (
            <Label size={12} color={colors.secondary}>
              Unsaved changes
            </Label>
          )}
        </View>
        {candidate && (
          <View style={{ marginBottom: 20, gap: 8 }}>
            <Badge tone="warning">Review before confirming</Badge>
            <Label size={12} color={colors.secondary}>
              {candidate.explanation}
            </Label>
            {candidate.missingFields.length > 0 && (
              <Label size={12} color={colors.warning}>
                Please check: {candidate.missingFields.join(", ")}.
              </Label>
            )}
          </View>
        )}
        {field("name", "Subscription name", {
          placeholder: "e.g. Spotify Premium",
          autoFocus: Boolean(initial),
          returnKeyType: "next",
          onSubmitEditing: () => setFocus("amount"),
        })}
        <View style={{ flexDirection: "row", gap: 16 }}>
          <View style={{ flex: 1 }}>
            {field(
              "amount",
              chosenCurrency
                ? "Your price (" + chosenCurrency + ")"
                : "Your price",
              {
                placeholder: "0.00",
                keyboardType: "decimal-pad",
              },
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Controller
              control={control}
              name="currency"
              render={({ field: f }) => (
                <SelectField
                  disabled={busy}
                  label="Currency"
                  testID="subscription-currency"
                  showDetail={false}
                  value={f.value}
                  onChange={f.onChange}
                  options={currencyOptions}
                  searchable
                  placeholder="Choose currency"
                  error={errors.currency?.message}
                />
              )}
            />
          </View>
        </View>
        <Controller
          control={control}
          name="interval"
          render={({ field: f }) => (
            <SelectField
              disabled={busy}
              label="Billing frequency"
              value={f.value}
              onChange={f.onChange}
              options={intervalOptions}
              testID="subscription-interval"
              placeholder="Choose frequency"
              error={errors.interval?.message}
            />
          )}
        />
        {interval === "custom" && (
          <View style={{ marginTop: 16 }}>
            {field("intervalCount", "Repeat every", {
              keyboardType: "number-pad",
            })}
            <Controller
              control={control}
              name="customUnit"
              render={({ field: f }) => (
                <Chips
                  disabled={busy}
                  values={["day", "week", "month", "year"] as const}
                  selected={f.value}
                  onChange={f.onChange}
                />
              )}
            />
          </View>
        )}
        <View style={{ marginTop: 22 }}>
          {dateField("nextRenewal", "Next renewal")}
        </View>
        <Label
          size={12}
          bold
          color={colors.secondary}
          style={{ marginBottom: 10 }}
        >
          Tracking status
        </Label>
        <Controller
          control={control}
          name="status"
          render={({ field: f }) => (
            <Chips
              disabled={busy}
              values={
                [
                  "active",
                  "trial",
                  "paused",
                  ...(initial?.status === "canceled" ||
                  initial?.status === "expired"
                    ? [initial.status]
                    : []),
                ] as const
              }
              selected={f.value}
              labels={{
                active: "Active",
                trial: "Trial",
                paused: "Paused",
                canceled: "Canceled",
                expired: "Expired",
              }}
              onChange={f.onChange}
            />
          )}
        />
        {status === "trial" && (
          <View style={{ marginTop: 20 }}>
            {dateField("trialEnd", "Trial ends")}
            <Label size={11} color={colors.secondary}>
              Enter the price that will apply after the trial.
            </Label>
          </View>
        )}
        <View style={{ marginTop: 17 }}>
          <Button
            variant="ghost"
            small
            icon={advanced ? ChevronUp : ChevronDown}
            disabled={busy}
            onPress={() => setAdvanced(!advanced)}
          >
            {advanced ? "Hide optional details" : "More details (optional)"}
          </Button>
        </View>
        {advanced && (
          <View style={{ marginTop: 12 }}>
            <View style={{ marginTop: 22 }}>
              <Controller
                control={control}
                name="category"
                render={({ field: f }) => (
                  <SelectField
                    disabled={busy}
                    label="Category"
                    value={f.value}
                    onChange={f.onChange}
                    options={categoryOptions}
                    testID="subscription-category"
                    searchable
                  />
                )}
              />
            </View>
            {dateField("startDate", "Started on")}
            {interval !== "custom" &&
              field("intervalCount", "Billing interval count", {
                keyboardType: "number-pad",
              })}
            {field("notes", "Notes (optional)", {
              multiline: true,
              numberOfLines: 3,
              style: { minHeight: 88, textAlignVertical: "top" },
            })}
          </View>
        )}
        {error && (
          <Label color={colors.error} style={{ marginTop: 14 }}>
            {error}
          </Label>
        )}
        {!page && saveBar}
      </Card>
      <PickerSheet
        visible={choosingService}
        title="Choose a service"
        description="Select a service or use a custom name in the form."
        onClose={() => setChoosingService(false)}
      >
        {choosingService && (
          <ServicePicker
            selected={serviceId}
            presentation="sheet"
            autoFocus
            onSelect={(service, customName) => {
              setServiceId(service?.id ?? null);
              setValue("name", service?.name ?? customName ?? "", {
                shouldDirty: true,
                shouldValidate: true,
              });
              setValue("category", service?.category ?? "Other", {
                shouldDirty: true,
              });
              setChoosingService(false);
              requestAnimationFrame(() => setFocus("amount"));
            }}
          />
        )}
      </PickerSheet>

      <Confirm
        visible={Boolean(pendingNavigation)}
        title="Discard unsaved changes?"
        body="Your edits have not been saved. Discarding them keeps the existing subscription record unchanged."
        action="Discard changes"
        cancelLabel="Keep editing"
        danger
        onClose={() => setPendingNavigation(null)}
        onConfirm={async () => {
          if (pendingNavigation) {
            const action = pendingNavigation;
            setPendingNavigation(null);
            navigation.dispatch(action);
          }
        }}
      />
    </View>
  );
  return page ? (
    <Page title={page.title} subtitle={page.subtitle} back footer={saveBar}>
      {content}
    </Page>
  ) : (
    content
  );
}
