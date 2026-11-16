import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Chip } from "@/components/Chip";
import { PrimaryButton } from "@/features/onboarding/components/PrimaryButton";
import { formatTime } from "@/features/schedule";
import { useSleepStore } from "@/features/sleep/store";
import { colors } from "@/utils/theme";

const WOKE_UP = [
  { label: "Just now", minutesAgo: 0 },
  { label: "15m ago", minutesAgo: 15 },
  { label: "30m ago", minutesAgo: 30 },
  { label: "1h ago", minutesAgo: 60 },
  { label: "2h ago", minutesAgo: 120 },
  { label: "3h ago", minutesAgo: 180 },
];

const LENGTHS = [
  { label: "10 min", minutes: 10 },
  { label: "20 min", minutes: 20 },
  { label: "30 min", minutes: 30 },
  { label: "45 min", minutes: 45 },
  { label: "1 hour", minutes: 60 },
  { label: "1.5 hours", minutes: 90 },
  { label: "2 hours", minutes: 120 },
];

const MINUTE = 60_000;

export default function LogNapScreen() {
  const { logNap, startNap, stopNap, activeNap } = useSleepStore();
  const [saving, setSaving] = useState(false);
  const [rating, setRating] = useState<number | undefined>();
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [length, setLength] = useState(20);
  // Fixed when the sheet opens so the summary doesn't drift while choosing.
  const [openedAt] = useState(Date.now);

  const end = openedAt - minutesAgo * MINUTE;
  const start = end - length * MINUTE;

  async function action(work: () => Promise<void>, close = true) {
    if (saving) return;
    setSaving(true);
    try { await work(); if (close) router.back(); }
    catch (e) { Alert.alert("Unable to save nap", e instanceof Error ? e.message : "Please try again."); }
    finally { setSaving(false); }
  }
  const save = () => action(() => logNap({ startedAt: new Date(start).toISOString(), endedAt: new Date(end).toISOString(), quality: rating }));

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">Log a nap</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <PrimaryButton title={activeNap ? "Stop active nap" : "Start nap now"}
          disabled={saving} onPress={() => action(() => activeNap ? stopNap(rating) : startNap(), !!activeNap)} />
        <Text style={styles.section}>How refreshed do you feel? (optional)</Text>
        <View style={styles.chips}>{[1,2,3,4,5].map(r => <Chip key={r} label={String(r)} selected={rating === r} onPress={() => setRating(r)} />)}</View>
        <Text style={styles.section}>Or log an earlier nap</Text>
        <Text style={styles.section}>When did you wake up?</Text>
        <View style={styles.chips}>
          {WOKE_UP.map((o) => (
            <Chip key={o.label} label={o.label} selected={o.minutesAgo === minutesAgo}
              onPress={() => setMinutesAgo(o.minutesAgo)} />
          ))}
        </View>

        <Text style={styles.section}>How long did you nap?</Text>
        <View style={styles.chips}>
          {LENGTHS.map((o) => (
            <Chip key={o.label} label={o.label} selected={o.minutes === length}
              onPress={() => setLength(o.minutes)} />
          ))}
        </View>

        <View style={styles.summary}>
          <Ionicons name="timer-outline" size={22} color={colors.primary} />
          <Text style={styles.summaryText}>{formatTime(start)} – {formatTime(end)}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title={saving ? "Saving…" : "Save nap"} disabled={saving || !!activeNap} onPress={save} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  content: { padding: 20, gap: 14 },
  section: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summary: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
  },
  summaryText: { fontSize: 17, fontWeight: "700", color: colors.text },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
});
