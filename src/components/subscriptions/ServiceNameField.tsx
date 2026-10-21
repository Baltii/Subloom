import { useMemo, useState } from "react";
import { Pressable, View, type TextInputProps } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { suggestServices, type Service } from "../../domain/catalog";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { useTheme } from "../../theme/useTheme";
import { Field, Label } from "../ui/Primitives";
import { ServiceIcon } from "./ServiceIcon";

export function ServiceNameField({
  value,
  onChangeText,
  onSelect,
  disabled,
  inputRef,
  error,
  ...props
}: Omit<TextInputProps, "value" | "onChangeText" | "editable"> & {
  value: string;
  onChangeText: (value: string) => void;
  onSelect: (service: Service) => void;
  disabled: boolean;
  inputRef: Parameters<typeof Field>[0]["inputRef"];
  error?: string;
}) {
  const { colors } = useTheme();
  const [edited, setEdited] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const query = value.trim();
  const settledQuery = useDebouncedValue(query);
  const matches = useMemo(() => suggestServices(settledQuery), [settledQuery]);
  // Hide outdated matches immediately while the latest keystroke is settling.
  const show =
    edited &&
    !dismissed &&
    !disabled &&
    query.length > 0 &&
    settledQuery === query;
  return (
    <View>
      <Field
        {...props}
        testID="subscription-name"
        label="Subscription name"
        value={value}
        inputRef={inputRef}
        error={error}
        editable={!disabled}
        hint="Choose a matching service below, or keep your own name."
        onChangeText={(next) => {
          setEdited(true);
          setDismissed(false);
          onChangeText(next);
        }}
        onKeyPress={(event) => {
          if (event.nativeEvent.key === "Escape") setDismissed(true);
          props.onKeyPress?.(event);
        }}
        onSubmitEditing={(event) => {
          setDismissed(true);
          props.onSubmitEditing?.(event);
        }}
      />
      {show && (
        <View
          testID="service-name-suggestions"
          style={{ marginBottom: 20, gap: 8 }}
        >
          <Label
            size={12}
            color={colors.secondary}
            accessibilityLiveRegion="polite"
          >
            {matches.length
              ? `Matching services (${matches.length})`
              : "No matching services. Keep this as a custom name."}
          </Label>
          {matches.length > 0 && (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {matches.map((service, index) => (
                <Pressable
                  key={service.id}
                  testID={`name-suggestion-${service.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${service.name}, ${service.category}`}
                  onPress={() => {
                    setEdited(false);
                    setDismissed(true);
                    onSelect(service);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    minHeight: 60,
                    padding: 10,
                    borderTopWidth: index ? 1 : 0,
                    borderTopColor: colors.border,
                    backgroundColor: pressed ? colors.mint : colors.surface,
                  })}
                >
                  <ServiceIcon
                    serviceId={service.id}
                    name={service.name}
                    size={34}
                  />
                  <View style={{ flex: 1 }}>
                    <Label bold>{service.name}</Label>
                    <Label size={12} color={colors.secondary}>
                      {service.category}
                    </Label>
                  </View>
                  <ChevronRight size={17} color={colors.secondary} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
