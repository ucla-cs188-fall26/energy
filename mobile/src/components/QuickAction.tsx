import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors, radius, spacing } from "@/utils/theme";

type Props = {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress?: () => void;
};

export function QuickAction({ icon, label, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={24} color={colors.primary} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  pressed: { backgroundColor: colors.primarySoft },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, textAlign: "center" },
});
