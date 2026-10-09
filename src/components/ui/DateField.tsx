import { useState } from "react";
import { Pressable, View } from "react-native";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react-native";
import { dateSchema } from "../../domain/models";
import {
  calendarDays,
  calendarMonth,
  moveCalendarMonth,
} from "../../domain/calendar";
import { dateLabel, today } from "../../domain/renewal";
import { useApp } from "../../store/app";
import { useTheme } from "../../theme/useTheme";
import { Button, Field, IconButton, Label } from "./Primitives";
import { PickerSheet } from "./Selection";

export function DateField({
  label,
  value,
  onChange,
  onBlur,
  error,
  testID,
}: {
  label: string;
  value: string;
  onChange: (date: string) => void;
  onBlur?: () => void;
  error?: string;
  testID?: string;
}) {
  const { colors, isDark } = useTheme();
  const timezone = useApp((s) => s.data.preferences.timezone),
    reference = today(timezone);
  const [open, setOpen] = useState(false),
    [month, setMonth] = useState(calendarMonth(value, reference)),
    [draft, setDraft] = useState(value);
  function show() {
    setMonth(calendarMonth(value, reference));
    setDraft(value);
    setOpen(true);
  }
  const valid = dateSchema.safeParse(value).success;
  return (
    <>
      <Field
        label={label}
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
        error={error}
        testID={testID}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={10}
        hint={
          valid
            ? dateLabel(value, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : "Choose a date or enter YYYY-MM-DD."
        }
        trailing={
          <IconButton
            icon={CalendarDays}
            label={"Choose " + label.toLowerCase() + " date"}
            onPress={show}
          />
        }
      />
      <PickerSheet
        visible={open}
        title={label}
        description="Choose the date that appears on your plan."
        onClose={() => setOpen(false)}
        footer={
          <Button
            disabled={!dateSchema.safeParse(draft).success}
            onPress={() => {
              onChange(draft);
              onBlur?.();
              setOpen(false);
            }}
          >
            Use selected date
          </Button>
        }
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <IconButton
            icon={ChevronLeft}
            label="Previous month"
            onPress={() => setMonth(moveCalendarMonth(month, -1))}
          />
          <Label bold size={17}>
            {dateLabel(month, { month: "long", year: "numeric" })}
          </Label>
          <IconButton
            icon={ChevronRight}
            label="Next month"
            onPress={() => setMonth(moveCalendarMonth(month, 1))}
          />
        </View>
        <View style={{ flexDirection: "row", marginBottom: 6 }}>
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((day) => (
            <View
              key={day}
              style={{
                width: `${100 / 7}%`,
                alignItems: "center",
                paddingVertical: 8,
              }}
            >
              <Label size={11} bold color={colors.secondary}>
                {day}
              </Label>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {calendarDays(month).map((date, index) => (
            <View
              key={date || index}
              style={{ width: `${100 / 7}%`, padding: 1 }}
            >
              {date ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: date === draft }}
                  aria-pressed={date === draft}
                  accessibilityLabel={dateLabel(date, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  onPress={() => setDraft(date)}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor:
                      date === draft
                        ? colors.primary
                        : pressed
                          ? colors.mint
                          : "transparent",
                    borderWidth: 1,
                    borderColor:
                      date === reference && date !== draft
                        ? colors.primary
                        : "transparent",
                  })}
                >
                  <Label
                    size={14}
                    bold={date === draft || date === reference}
                    color={
                      date === draft
                        ? isDark
                          ? "#102219"
                          : "#FFFFFF"
                        : colors.text
                    }
                  >
                    {Number(date.slice(-2))}
                  </Label>
                </Pressable>
              ) : (
                <View style={{ minHeight: 44 }} />
              )}
            </View>
          ))}
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 16,
          }}
        >
          <Button
            small
            variant="ghost"
            onPress={() => {
              setDraft(reference);
              setMonth(calendarMonth(reference, reference));
            }}
          >
            Today
          </Button>
          <Label size={12} color={colors.secondary}>
            {dateSchema.safeParse(draft).success
              ? dateLabel(draft)
              : "No date selected"}
          </Label>
        </View>
      </PickerSheet>
    </>
  );
}
