import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ComponentProps } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { categoryIcon } from "@/features/caffeine/catalog";
import { useCaffeineStore, useTodayEntries, useTodayTotalMg } from "@/features/caffeine/store";
import { CaffeineEntry } from "@/features/caffeine/types";
import { colors, radius, spacing } from "@/utils/theme";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDuration(minutes: number) {
  if (minutes < 30) return "";
  return minutes < 60 ? ` · over ~${minutes} min` : ` · over ~${minutes / 60}h`;
}

export default function CaffeineScreen() {
  const today = useTodayEntries();
  const totalMg = useTodayTotalMg();
  const removeEntry = useCaffeineStore((s) => s.removeEntry);

  const confirmDelete = (e: CaffeineEntry) =>
    Alert.alert("Delete drink?", `${e.name} · ${e.mg} mg`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeEntry(e.id) },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Caffeine</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Intake</Text>
          <View style={styles.intakeRow}>
            <Ionicons name="cafe-outline" size={36} color={colors.primary} />
            <View>
              <Text style={styles.intakeValue}>{totalMg} mg</Text>
              <Text style={styles.muted}>
                {today.length} {today.length === 1 ? "drink" : "drinks"} today
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <ActionButton
            icon="camera"
            label="Scan Drink"
            onPress={() => Alert.alert("Coming soon", "Photo logging will be added in a later step.")}
          />
          <ActionButton icon="add" label="Add Manually" onPress={() => router.push("/log-drink")} />
        </View>

        <Text style={styles.sectionTitle}>Today's Drinks</Text>
        {today.length === 0 ? (
          <View style={[styles.card, styles.empty]}>
            <Text style={styles.muted}>No drinks logged yet today.</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {today.map((e, i) => (
              <View key={e.id} style={[styles.drinkRow, i > 0 && styles.drinkRowDivider]}>
                <Ionicons name={categoryIcon(e.categoryId)} size={22} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.drinkName}>{e.name}</Text>
                  <Text style={styles.muted}>
                    {e.mg} mg · {formatTime(e.consumedAt)}
                    {formatDuration(e.durationMinutes)}
                  </Text>
                </View>
                <Pressable onPress={() => confirmDelete(e)} hitSlop={10} accessibilityLabel={`Delete ${e.name}`}>
                  <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.85 }]}>
      <Ionicons name={icon} size={22} color="#fff" />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  title: { fontSize: 20, fontWeight: "700", color: colors.text, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  intakeRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  intakeValue: { fontSize: 30, fontWeight: "700", color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  actions: { flexDirection: "row", gap: spacing.sm },
  actionButton: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  actionLabel: { color: "#fff", fontWeight: "700", fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  empty: { alignItems: "center", paddingVertical: spacing.lg },
  drinkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  drinkRowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  drinkName: { fontSize: 15, fontWeight: "600", color: colors.text },
});
