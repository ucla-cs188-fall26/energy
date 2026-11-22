import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { CaffeineChart } from "@/features/caffeine/CaffeineChart";
import { categoryForEntryName, DRINK_CATEGORIES, PRESET_IDS, servingMl } from "@/features/caffeine/catalog";
import { DrinkDetailSheet } from "@/features/caffeine/DrinkDetailSheet";
import { BEDTIME_OK_MG, DAILY_LIMIT_MG } from "@/features/caffeine/model";
import { useCaffeineStore, useTodayEntries } from "@/features/caffeine/store";
import { CaffeineEntry } from "@/features/caffeine/types";
import { useCaffeineSummary } from "@/features/caffeine/useCaffeineSummary";
import { formatHour, formatTime } from "@/features/schedule";
import { useNow } from "@/hooks/useNow";
import { colors } from "@/utils/theme";

import { useTrackingRefresh } from "@/hooks/useTrackingRefresh";
import { SyncStatus } from "@/components/SyncStatus";
const SUCCESS = "#15803D";
const SUCCESS_SOFT = "#E7F6EC";
const WARN = "#B45309";
const WARN_SOFT = "#FDF1E3";

/** One-tap drinks from the catalog: [category id, option id, tile label, minutes to finish]. */
const QUICK_ADD: [string, string, string, number][] = [
  ["espresso", "espresso-single", "Espresso", 10],
  ["coffee", "coffee-8", "Coffee 8 oz", 30],
  ["tea", "black-tea", "Black tea", 30],
  ["energy", "redbull-8", "Energy drink", 30],
];

const QUICK_ITEMS = QUICK_ADD.map(([categoryId, optionId, label, durationMinutes]) => {
  const option = DRINK_CATEGORIES.find((c) => c.id === categoryId)!.options.find((o) => o.id === optionId)!;
  return { categoryId, option, label, durationMinutes };
});

export default function CaffeineScreen() {
  const now = useNow();
  useTrackingRefresh();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<CaffeineEntry | null>(null);
  const [history, setHistory] = useState(false);
  const { entries, presets } = useCaffeineStore();
  const items = history ? [...entries].sort((a,b) => b.consumedAt.localeCompare(a.consumedAt)) : null;
  async function perform(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await work(); } catch (e) { Alert.alert("Unable to save drink", e instanceof Error ? e.message : "Try again."); }
    finally { setBusy(false); }
  }
  const summary = useCaffeineSummary(now);
  const today = useTodayEntries(now);
  const addEntry = useCaffeineStore((s) => s.addEntry);
  const removeEntry = useCaffeineStore((s) => s.removeEntry);

  const quickItems = QUICK_ITEMS.map(q => {
    const preset = presets.find(p => p.id === PRESET_IDS[q.option.id]);
    return { ...q, option: { ...q.option, mg: Number(preset?.caffeine_mg ?? q.option.mg) } };
  });
  const overLimit = summary.todayMg > DAILY_LIMIT_MG;
  const bedtimeOk = summary.atBedtimeMg < BEDTIME_OK_MG;

  const confirmDelete = (e: CaffeineEntry) =>
    Alert.alert("Delete drink?", `${e.name} · ${e.mg} mg`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void perform(() => removeEntry(e.id)) },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">Caffeine</Text>

        <SyncStatus />
        <Card style={styles.gap}>
          <View style={styles.todayRow}>
            <View>
              <Text style={styles.muted}>Today</Text>
              <Text style={styles.big}>{summary.todayMg} mg</Text>
            </View>
            <Text style={[styles.muted, overLimit && { color: WARN }]}>of {DAILY_LIMIT_MG} mg daily limit</Text>
          </View>
          <View style={styles.track} accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: DAILY_LIMIT_MG, now: summary.todayMg }}>
            <View style={[styles.fill, {
              width: `${Math.min(100, (summary.todayMg / DAILY_LIMIT_MG) * 100)}%`,
              backgroundColor: overLimit ? WARN : colors.primary,
            }]} />
          </View>
          <View style={styles.tiles}>
            <View style={[styles.tile, { backgroundColor: colors.background }]}>
              <Text style={styles.tileLabel}>In system now</Text>
              <Text style={styles.tileValue}>{summary.inSystemMg} mg</Text>
            </View>
            <View style={[styles.tile, { backgroundColor: bedtimeOk ? SUCCESS_SOFT : WARN_SOFT }]}>
              <Text style={styles.tileLabel}>{summary.bedtime === null ? "At bedtime" : `At ${formatHour(summary.bedtime)} bedtime`}</Text>
              <Text style={[styles.tileValue, { color: bedtimeOk ? SUCCESS : WARN }]}>{summary.atBedtimeMg} mg</Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Caffeine in your system</Text>
          <View style={styles.chart}>
            <CaffeineChart points={summary.curve} now={summary.chartNow}
              bedtime={summary.bedtime} bedMg={summary.atBedtimeMg} empty={summary.noRecentDoses} />
          </View>
        </Card>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Quick add</Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            style={styles.scan}
            onPress={() => Alert.alert("Coming soon", "Photo logging will be added in a later step.")}
          >
            <Ionicons name="scan-outline" size={22} color={colors.primary} />
            <Text style={styles.link}>Scan drink</Text>
          </Pressable>
        </View>

        <View style={styles.grid}>
          {quickItems.map((q) => (
            <Pressable
              key={q.option.id}
              accessibilityRole="button"
              accessibilityLabel={`Log ${q.label}, ${q.option.mg} milligrams`}
              disabled={busy}
              onPress={() => void perform(async () => {
                const preset = presets.find(p => p.id === PRESET_IDS[q.option.id]);
                await addEntry({ name: preset?.beverage_name ?? `${q.option.label} (${q.option.size})`,
                  mg: Number(preset?.caffeine_mg ?? q.option.mg),
                  servingSizeMl: Number(preset?.serving_size_ml ?? servingMl(q.option)),
                  presetId: preset?.id, consumedAt: new Date().toISOString(), durationMinutes: 0 });
              })}
              style={({ pressed }) => [styles.quick, pressed && styles.pressed]}
            >
              <View style={styles.plus}>
                <Ionicons name="add" size={22} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.quickName}>{q.label}</Text>
                <Text style={styles.quickMg}>{q.option.mg} mg</Text>
              </View>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Add another drink"
          onPress={() => router.push("/log-drink")}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
          <Ionicons name="add-circle" size={24} color={colors.surface} />
          <Text style={styles.moreText}>Add another drink</Text>
        </Pressable>

        <Pressable onPress={() => setHistory(!history)}><Text style={styles.link}>{history ? "Show today" : "Show all history"}</Text></Pressable>
        {(items ?? today).length ? (
          <Card style={styles.list}>
            {(items ?? today).map((e, i) => (
              <View key={e.id} style={[styles.drinkRow, i > 0 && styles.divider]}>
                <View style={styles.flex}>
                  <Text style={styles.drinkName}>{e.name}</Text>
                  <Text style={styles.muted}>{history ? new Date(e.consumedAt).toLocaleDateString() + " · " : ""}{formatTime(Date.parse(e.consumedAt))}</Text>
                </View>
                <Text style={styles.drinkMg}>{e.mg} mg</Text>
                <Pressable disabled={busy} accessibilityLabel={`Edit ${e.name}`} onPress={() => setEditing(e)}>
                  <Ionicons name="create-outline" size={20} color={colors.primary} />
                </Pressable>
                <Pressable onPress={() => confirmDelete(e)} hitSlop={10} disabled={busy} accessibilityLabel={`Delete ${e.name}`}>
                  <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </Card>
        ) : (
          <Card><Text style={styles.muted}>{history ? "No drinks logged yet." : "No drinks logged yet today."}</Text></Card>
        )}
      </ScrollView>

      {/* Editing uses the same sheet as logging a new drink. */}
      <DrinkDetailSheet
        category={editing ? categoryForEntryName(editing.name) : null}
        entry={editing}
        onClose={() => setEditing(null)}
        onLogged={() => setEditing(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 18 },
  flex: { flex: 1 },
  title: { fontSize: 34, fontWeight: "800", color: colors.text, marginTop: 8 },
  gap: { gap: 16 },
  todayRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  muted: { fontSize: 16, color: colors.textMuted },
  big: { fontSize: 40, fontWeight: "800", color: colors.text },
  track: { height: 14, borderRadius: 7, backgroundColor: colors.primarySoft, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 7 },
  tiles: { flexDirection: "row", gap: 12 },
  tile: { flex: 1, borderRadius: 16, padding: 14, gap: 4 },
  tileLabel: { fontSize: 15, color: colors.textMuted },
  tileValue: { fontSize: 22, fontWeight: "800", color: colors.text },
  cardTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  chart: { marginTop: 12 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  sectionTitle: { fontSize: 24, fontWeight: "800", color: colors.text },
  scan: { flexDirection: "row", alignItems: "center", gap: 8 },
  link: { fontSize: 18, fontWeight: "700", color: colors.primary },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  quick: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.7 },
  plus: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  quickName: { fontSize: 17, fontWeight: "700", color: colors.text },
  quickMg: { fontSize: 15, color: colors.textMuted },
  more: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primary,
  },
  moreText: { fontSize: 18, fontWeight: "700", color: colors.surface },
  list: { paddingVertical: 8 },
  drinkRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  drinkName: { fontSize: 18, fontWeight: "700", color: colors.text },
  drinkMg: { fontSize: 18, fontWeight: "800", color: colors.text },
});
