import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/utils/theme";

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
      <View style={styles.iconTile}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 22,
    paddingVertical: 18,
  },
  pressed: { opacity: 0.7 },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 16, fontWeight: "700", color: colors.text, textAlign: "center" },
});
