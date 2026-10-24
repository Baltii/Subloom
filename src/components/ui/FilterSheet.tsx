import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { SlidersHorizontal } from "lucide-react-native";
import { Button, Label } from "./Primitives";
import { PickerSheet } from "./Selection";
import { useTheme } from "../../theme/useTheme";

/** Draft choices stay local until Apply; closing never changes the results. */
export function FilterSheet<T>({
  title,
  value,
  defaults,
  count,
  summary,
  onApply,
  children,
}: {
  title: string;
  value: T;
  defaults: T;
  count: number;
  summary?: string;
  onApply: (value: T) => void;
  children: (draft: T, update: (value: T) => void) => ReactNode;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  return (
    <View style={{ gap: 8, marginBottom: 16 }}>
      <View style={{ alignSelf: "flex-start" }}>
        <Button
          small
          variant="secondary"
          icon={SlidersHorizontal}
          onPress={() => {
            setDraft(value);
            setOpen(true);
          }}
        >
          {count ? `Filters · ${count}` : "Filters"}
        </Button>
      </View>
      {summary ? (
        <Label size={12} color={colors.secondary}>
          {summary}
        </Label>
      ) : null}
      <PickerSheet
        visible={open}
        title={title}
        description="Choose your filters, then apply them together."
        onClose={() => setOpen(false)}
        footer={
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Button
                variant="secondary"
                onPress={() => {
                  onApply(defaults);
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                onPress={() => {
                  onApply(draft);
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </View>
          </View>
        }
      >
        <View style={{ gap: 24, paddingBottom: 12 }}>
          {children(draft, setDraft)}
        </View>
      </PickerSheet>
    </View>
  );
}
