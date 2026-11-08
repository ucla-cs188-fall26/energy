import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DRINK_PRESETS, DrinkPreset } from "@/features/caffeine/presets";
import { useCaffeineStore } from "@/features/caffeine/store";
import { colors, radius, spacing } from "@/utils/theme";

const WHEN_OPTIONS = [
  { label: "Now", minutesAgo: 0 },
  { label: "15m ago", minutesAgo: 15 },
  { label: "30m ago", minutesAgo: 30 },
  { label: "1h ago", minutesAgo: 60 },
  { label: "2h ago", minutesAgo: 120 },
];

const MAX_MG = 1000;

export default function LogDrinkScreen() {
  const addEntry = useCaffeineStore((s) => s.addEntry);
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [customName, setCustomName] = useState("");
  const [customMg, setCustomMg] = useState("");

  const consumedAt = () => new Date(Date.now() - minutesAgo * 60_000).toISOString();

  const logPreset = (p: DrinkPreset) => {
    addEntry({ name: p.name, mg: p.mg, presetId: p.id, consumedAt: consumedAt() });
    router.back();
  };

  const mg = Number(customMg);
  const customValid = Number.isFinite(mg) && mg > 0 && mg <= MAX_MG;

  const logCustom = () => {
    if (!customValid) return;
    addEntry({ name: customName.trim() || "Custom drink", mg: Math.round(mg), consumedAt: consumedAt() });
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Log a Drink</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>When?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {WHEN_OPTIONS.map((o) => {
              const selected = o.minutesAgo === minutesAgo;
              return (
                <Pressable
                  key={o.label}
                  onPress={() => setMinutesAgo(o.minutesAgo)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.sectionTitle}>Tap a drink to log it</Text>
          <View style={styles.grid}>
            {DRINK_PRESETS.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => logPreset(p)}
                style={({ pressed }) => [styles.preset, pressed && styles.presetPressed]}
              >
                <Ionicons name={p.icon} size={22} color={colors.primary} />
                <Text style={styles.presetName}>{p.name}</Text>
                <Text style={styles.presetMg}>{p.mg} mg</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Custom</Text>
          <View style={styles.customCard}>
            <TextInput
              style={styles.input}
              placeholder="Drink name (optional)"
              placeholderTextColor={colors.textMuted}
              value={customName}
              onChangeText={setCustomName}
            />
            <TextInput
              style={styles.input}
              placeholder="Caffeine (mg)"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={customMg}
              onChangeText={setCustomMg}
            />
            <Pressable
              onPress={logCustom}
              disabled={!customValid}
              style={[styles.addButton, !customValid && styles.addButtonDisabled]}
            >
              <Text style={styles.addButtonText}>Add Drink</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: spacing.sm },
  chips: { gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "500" },
  chipTextSelected: { color: colors.primary, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  preset: {
    width: "48.5%",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  presetPressed: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  presetName: { fontSize: 14, fontWeight: "600", color: colors.text, marginTop: spacing.xs },
  presetMg: { fontSize: 13, color: colors.textMuted },
  customCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  addButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: "center" },
  addButtonDisabled: { opacity: 0.4 },
  addButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
