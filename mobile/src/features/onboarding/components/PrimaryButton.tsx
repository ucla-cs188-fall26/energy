import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { colors } from "@/utils/theme";

type Props = { title: string; onPress: () => void; disabled?: boolean; loading?: boolean };

export function PrimaryButton({ title, onPress, disabled, loading }: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, inactive && styles.disabled]}
    >
      {loading ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.title}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  title: { color: colors.surface, fontSize: 18, fontWeight: "700" },
});
