import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, spacing } from "@/utils/theme";

// Placeholder values — these will come from real logging + the caffeine model in later steps.
const stats = [
  { label: "Caffeine in system", value: "0 mg" },
  { label: "Caffeine-clear time", value: "--" },
  { label: "Recommended bedtime", value: "--" },
];

export default function TodayScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.greeting}>Today</Text>
        <Text style={styles.subtitle}>Track your caffeine. Protect your sleep.</Text>

        <View style={styles.cards}>
          {stats.map((s) => (
            <View key={s.label} style={styles.card}>
              <Text style={styles.cardLabel}>{s.label}</Text>
              <Text style={styles.cardValue}>{s.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.empty}>
          <Text style={styles.emptyText}>No drinks logged yet today.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  greeting: { color: colors.text, fontSize: 32, fontWeight: "700" },
  subtitle: { color: colors.textMuted, fontSize: 15 },
  cards: { gap: spacing.sm, marginTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
  },
  cardLabel: { color: colors.textMuted, fontSize: 13 },
  cardValue: { color: colors.text, fontSize: 24, fontWeight: "600", marginTop: spacing.xs },
  empty: { alignItems: "center", paddingVertical: spacing.xl },
  emptyText: { color: colors.textMuted },
});
