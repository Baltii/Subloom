import { Field } from "../ui/Primitives";

export function PinField({
  label,
  value,
  onChange,
  onSubmit,
  disabled = false,
  autoFocus = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  error?: string;
}) {
  return (
    <Field
      label={label}
      error={error}
      value={value}
      onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, 6))}
      secureTextEntry
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={6}
      autoComplete="off"
      textContentType="none"
      autoCorrect={false}
      autoCapitalize="none"
      editable={!disabled}
      autoFocus={autoFocus}
      onSubmitEditing={onSubmit}
      returnKeyType="done"
    />
  );
}
