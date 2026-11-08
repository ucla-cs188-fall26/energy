import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/utils/theme";

type Props = {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
};

export function StatCard({ icon, label, value }: Props) {
  return (
    <View style={styles.card}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <View>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  label: { fontSize: 13, color: colors.textMuted },
  value: { fontSize: 16, fontWeight: "700", color: colors.text },
});
