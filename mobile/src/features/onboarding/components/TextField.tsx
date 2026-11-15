import { ReactNode, useState } from "react";
import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";

import { colors } from "@/utils/theme";

type Props = TextInputProps & {
  label: string;
  /** Shown at the right of the label row, e.g. a "Forgot password?" link. */
  labelAccessory?: ReactNode;
  /** Unit text or a control inside the field's right edge, e.g. "kg" or a Show button. */
  suffix?: ReactNode;
  error?: string | null;
  containerStyle?: ViewStyle;
};

export function TextField({ label, labelAccessory, suffix, error, containerStyle, style, ...input }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelAccessory}
      </View>
      <View style={[styles.field, focused && styles.focused, !!error && styles.invalid]}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#8E8BA0"
          {...input}
          onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
          style={[styles.input, style]}
        />
        {typeof suffix === "string" ? <Text style={styles.suffix}>{suffix}</Text> : suffix}
      </View>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

export const ERROR_COLOR = "#C2410C";

const styles = StyleSheet.create({
  container: { gap: 10 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 16, fontWeight: "700", color: colors.text },
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
    paddingHorizontal: 18,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  focused: { borderColor: colors.primary },
  invalid: { borderColor: ERROR_COLOR },
  input: { flex: 1, paddingVertical: 14, fontSize: 18, fontWeight: "600", color: colors.text },
  suffix: { marginLeft: 8, fontSize: 16, color: colors.textMuted },
  error: { fontSize: 14, color: ERROR_COLOR },
});
