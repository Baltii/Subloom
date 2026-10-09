import { useState } from "react";
import { View, Pressable } from "react-native";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { Check, Search } from "lucide-react-native";
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
import { today } from "../domain/renewal";
import { saveSubscription, readableError, useApp } from "../store/app";
import {
  Badge,
  Button,
  Card,
  Chips,
  Field,
  Heading,
  Label,
} from "../components/ui/Primitives";
import { ServiceIcon } from "../components/subscriptions/ServiceIcon";
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
}: {
  initial?: Subscription;
  candidate?: Candidate;
}) {
  const { colors } = useTheme(),
    wide = useWide(),
    preferences = useApp((s) => s.data.preferences);
  const [serviceId, setServiceId] = useState(
      initial?.serviceId || candidate?.serviceId || null,
    ),
    [search, setSearch] = useState(""),
    [error, setError] = useState<string | null>(null),
    [advanced, setAdvanced] = useState(Boolean(initial)),
    [busy, setBusy] = useState(false);
  const currency =
    initial?.currency ||
    candidate?.currency ||
    (candidate ? "" : preferences.currency);
  const {
    control,
    setValue,
    handleSubmit,
    formState: { errors },
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
        (candidate ? "" : today(preferences.timezone)),
      startDate:
        initial?.startDate ||
        candidate?.chargeDate ||
        today(preferences.timezone),
      trialEnd: initial?.trialEnd || candidate?.trialEnd || "",
      status: initial?.status || (candidate?.trialEnd ? "trial" : "active"),
      paymentMethod: initial?.paymentMethod || "",
      notes: initial?.notes || "",
    },
  });
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
            error={errors[name]?.message}
            {...extra}
          />
        )}
      />
    );
  }
  async function submit(values: z.output<typeof formSchema>) {
    setBusy(true);
    setError(null);
    try {
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
      router.replace({ pathname: "/subscription/[id]", params: { id } });
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ maxWidth: 780, width: "100%", alignSelf: "center" }}>
      {!initial && !candidate && (
        <Card style={{ marginBottom: 22 }}>
          <Heading size={18}>Start with a service you know.</Heading>
          <View style={{ marginTop: 14 }}>
            <Field
              label="Find a service"
              placeholder="Search Netflix, Spotify, iCloud…"
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
            {catalog
              .filter((s) =>
                s.name.toLowerCase().includes(search.toLowerCase()),
              )
              .slice(0, search ? 12 : 8)
              .map((service) => (
                <Pressable
                  key={service.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: serviceId === service.id }}
                  onPress={() => {
                    setServiceId(service.id);
                    setValue("name", service.name);
                    setValue("category", service.category);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    borderWidth: 1,
                    borderColor:
                      serviceId === service.id ? colors.primary : colors.border,
                    padding: 9,
                    paddingRight: 14,
                    borderRadius: 12,
                    backgroundColor:
                      serviceId === service.id
                        ? colors.mint
                        : colors.background,
                  }}
                >
                  <ServiceIcon
                    serviceId={service.id}
                    name={service.name}
                    size={27}
                  />
                  <Label size={12}>{service.name}</Label>
                </Pressable>
              ))}
          </View>
          <Label size={11} color={colors.secondary} style={{ marginTop: 17 }}>
            Prices are personal. Enter the amount you actually pay below.
          </Label>
        </Card>
      )}
      <Card style={{ padding: wide ? 30 : 20 }}>
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
            <Label
              size={12}
              bold
              color={colors.secondary}
              style={{ marginBottom: 8 }}
            >
              Currency
            </Label>
            <Controller
              control={control}
              name="currency"
              render={({ field: f }) => (
                <Chips
                  values={currencies}
                  selected={f.value}
                  onChange={f.onChange}
                />
              )}
            />
            {errors.currency && (
              <Label size={12} color={colors.error}>
                {errors.currency.message}
              </Label>
            )}
          </View>
        </View>
        <Label
          size={12}
          bold
          color={colors.secondary}
          style={{ marginBottom: 10 }}
        >
          Billing frequency
        </Label>
        <Controller
          control={control}
          name="interval"
          render={({ field: f }) => (
            <Chips
              values={intervals}
              selected={f.value}
              onChange={f.onChange}
            />
          )}
        />
        {errors.interval && (
          <Label size={12} color={colors.error}>
            {errors.interval.message}
          </Label>
        )}
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
                  values={["day", "week", "month", "year"] as const}
                  selected={f.value}
                  onChange={f.onChange}
                />
              )}
            />
          </View>
        )}
        <View style={{ marginTop: 22 }}>
          {field("nextRenewal", "Next renewal · YYYY-MM-DD", {
            placeholder: "2026-10-31",
            autoCapitalize: "none",
          })}
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
              values={["active", "trial", "paused"] as const}
              selected={f.value as "active" | "trial" | "paused"}
              onChange={f.onChange}
            />
          )}
        />
        {status === "trial" && (
          <View style={{ marginTop: 20 }}>
            {field("trialEnd", "Trial ends · YYYY-MM-DD", {
              placeholder: "2026-10-31",
            })}
            <Label size={11} color={colors.secondary}>
              Enter the price that will apply after the trial.
            </Label>
          </View>
        )}
        <View style={{ marginTop: 22 }}>
          <Label
            size={12}
            bold
            color={colors.secondary}
            style={{ marginBottom: 10 }}
          >
            Category
          </Label>
          <Controller
            control={control}
            name="category"
            render={({ field: f }) => (
              <Chips
                values={categories}
                selected={f.value}
                onChange={f.onChange}
              />
            )}
          />
        </View>
        <View style={{ marginTop: 17 }}>
          <Button
            variant="ghost"
            small
            icon={Search}
            onPress={() => setAdvanced(!advanced)}
          >
            {advanced ? "Hide extra details" : "Add extra details"}
          </Button>
        </View>
        {advanced && (
          <View style={{ marginTop: 12 }}>
            {field("startDate", "Started on · YYYY-MM-DD")}
            {interval !== "custom" &&
              field("intervalCount", "Billing interval count", {
                keyboardType: "number-pad",
              })}
            {field("paymentMethod", "Payment nickname (optional)", {
              placeholder: "e.g. Personal card — never a full card number",
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
        <View style={{ marginTop: 23 }}>
          <Button
            testID="save-subscription"
            icon={Check}
            loading={busy}
            onPress={() => void handleSubmit(submit)()}
          >
            {candidate
              ? initial
                ? "Confirm update"
                : "Confirm subscription"
              : initial
                ? "Save changes"
                : "Add subscription"}
          </Button>
        </View>
        <Label
          size={10}
          color={colors.secondary}
          style={{ textAlign: "center", marginTop: 12 }}
        >
          Saved on this device
          {useApp.getState().identity !== "guest"
            ? " and queued for secure sync"
            : ""}
          .
        </Label>
      </Card>
    </View>
  );
}
