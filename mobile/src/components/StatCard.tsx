import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/utils/theme";

type Props = {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  detail?: string;
};

export function StatCard({ icon, label, value, detail }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <Ionicons name={icon} size={20} color={colors.primary} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={styles.value}>{value}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: 24, padding: 18, gap: 8 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 16, color: colors.textMuted },
  value: { fontSize: 28, fontWeight: "800", color: colors.text },
  detail: { fontSize: 15, color: colors.textMuted },
});
