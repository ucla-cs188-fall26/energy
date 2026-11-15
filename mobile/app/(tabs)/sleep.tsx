import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { BEDTIME_OK_MG } from "@/features/caffeine/model";
import { useCaffeineSummary } from "@/features/caffeine/useCaffeineSummary";
import { PrimaryButton } from "@/features/onboarding/components/PrimaryButton";
import { Segmented } from "@/features/onboarding/components/Segmented";
import { formatClock, formatDuration as formatSleepWindow, sleepWindowMinutes } from "@/features/onboarding/store";
import { useProfileSettings } from "@/features/profile/store";
import { formatDuration, formatTime, nextOccurrence } from "@/features/schedule";
import {
  estimateCycles, Nap, PLACEHOLDER_QUALITY, PLACEHOLDER_STAGES, SleepSession, sessionMinutes, useLastSleep, useSleepStore,
} from "@/features/sleep/store";
import { useNow } from "@/hooks/useNow";
import { colors } from "@/utils/theme";

const SUCCESS = "#15803D";
const SUCCESS_SOFT = "#E7F6EC";
const WARN = "#B45309";
const WARN_SOFT = "#FDF1E3";
const STAGE_COLORS = { light: "#B9A8F5", deep: "#4C2DB8", rem: "#5BB8E4" } as const;
const STAGE_LABELS = { light: "Light", deep: "Deep", rem: "REM" } as const;
const MINUTE = 60_000;

type Tab = "tonight" | "history";

export default function SleepScreen() {
  const [tab, setTab] = useState<Tab>("tonight");
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">Sleep</Text>
        <Segmented<Tab>
          accessibilityLabel="Sleep view"
          options={[{ value: "tonight", label: "Tonight" }, { value: "history", label: "History" }]}
          value={tab}
          onChange={setTab}
          variant="light"
        />
        {tab === "tonight" ? <Tonight /> : <History />}
      </ScrollView>
    </SafeAreaView>
  );
}

function bedtimeLabel(minutesUntil: number) {
  // Within an hour or so after bedtime still counts as "tonight".
  const label = (m: number) => (m < 60 ? `${m} min` : formatDuration(m));
  if (minutesUntil > 22 * 60) return `Bedtime was ${label(24 * 60 - minutesUntil)} ago`;
  return `Bedtime in ${label(minutesUntil)}`;
}

function Tonight() {
  const now = useNow();
  const { bedtimeMinutes, wakeMinutes } = useProfileSettings();
  const { atBedtimeMg } = useCaffeineSummary(now);
  const active = useSleepStore((s) => s.active);
  const startSleep = useSleepStore((s) => s.startSleep);
  const lastSleep = useLastSleep();

  const minutesUntil = Math.round((nextOccurrence(bedtimeMinutes, now) - now) / MINUTE) % (24 * 60);
  const caffeineOk = atBedtimeMg < BEDTIME_OK_MG;

  return (
    <>
      <Card style={styles.cardGap}>
        <View style={styles.readyRow}>
          <View style={styles.moonTile}>
            <Ionicons name="moon-outline" size={28} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.readyTitle}>{active ? "You’re asleep" : "Ready for bed?"}</Text>
            <Text style={styles.muted}>
              {active ? `Since ${formatTime(Date.parse(active.startedAt))}` : bedtimeLabel(minutesUntil)}
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sleep schedule: bedtime ${formatClock(bedtimeMinutes)}, alarm ${formatClock(wakeMinutes)}. Edit`}
          onPress={() => router.push("/sleep-schedule")}
          style={({ pressed }) => [styles.scheduleRow, pressed && styles.pressed]}
        >
          <ScheduleCell label="Bedtime" value={formatClock(bedtimeMinutes)} />
          <ScheduleCell label="Alarm" value={formatClock(wakeMinutes)} divider />
          <ScheduleCell label="Window" value={formatSleepWindow(sleepWindowMinutes(bedtimeMinutes, wakeMinutes))} divider />
          <Ionicons name="create-outline" size={18} color={colors.primary} style={styles.editIcon} />
        </Pressable>

        <View style={[styles.pill, { backgroundColor: caffeineOk ? SUCCESS_SOFT : WARN_SOFT }]}>
          <Ionicons name={caffeineOk ? "checkmark" : "alert-circle-outline"} size={20} color={caffeineOk ? SUCCESS : WARN} />
          <Text style={[styles.pillText, { color: caffeineOk ? SUCCESS : WARN }]}>
            About {atBedtimeMg} mg caffeine left by bedtime
          </Text>
        </View>

        <PrimaryButton
          title={active ? "Open sleep screen" : "Start sleep"}
          onPress={() => { startSleep(); router.push("/sleeping"); }}
        />
      </Card>

      <NapsToday now={now} />

      {lastSleep ? <LastNight session={lastSleep} /> : (
        <Card>
          <Text style={styles.cardTitle}>Last night</Text>
          <Text style={[styles.muted, styles.emptyText]}>
            No sleep logged yet. Tap Start sleep when you go to bed.
          </Text>
        </Card>
      )}
    </>
  );
}

function NapsToday({ now }: { now: number }) {
  const naps = useSleepStore((s) => s.naps);
  const removeNap = useSleepStore((s) => s.removeNap);
  const startOfDay = new Date(now).setHours(0, 0, 0, 0);
  const today = naps
    .filter((n) => Date.parse(n.endedAt) >= startOfDay)
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt));

  const confirmDelete = (nap: Nap) =>
    Alert.alert("Delete nap?", `${formatTime(Date.parse(nap.startedAt))} – ${formatTime(Date.parse(nap.endedAt))}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => removeNap(nap.id) },
    ]);

  return (
    <Card>
      <View style={styles.lastHeader}>
        <Text style={styles.cardTitle}>Naps today</Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.push("/log-nap")}
          style={({ pressed }) => [styles.napButton, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={styles.napButtonText}>Log nap</Text>
        </Pressable>
      </View>
      {today.length ? today.map((n, i) => (
        <View key={n.id} style={[styles.historyRow, i > 0 && styles.historyDivider]}>
          <Text style={[styles.muted, styles.flex]}>
            {formatTime(Date.parse(n.startedAt))} – {formatTime(Date.parse(n.endedAt))}
          </Text>
          <Text style={styles.napValue}>{formatDuration(sessionMinutes(n))}</Text>
          <Pressable onPress={() => confirmDelete(n)} hitSlop={10} accessibilityLabel="Delete nap">
            <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      )) : <Text style={[styles.muted, styles.emptyText]}>No naps logged today.</Text>}
    </Card>
  );
}

function ScheduleCell({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  return (
    <View style={[styles.cell, divider && styles.cellDivider]}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  );
}

function LastNight({ session }: { session: SleepSession }) {
  const minutes = sessionMinutes(session);
  return (
    <Card>
      <View style={styles.lastHeader}>
        <Text style={styles.cardTitle}>Last night</Text>
        <Text style={styles.muted}>
          {formatTime(Date.parse(session.startedAt))} – {formatTime(Date.parse(session.endedAt))}
        </Text>
      </View>
      <View style={styles.statsRow}>
        <Stat value={formatDuration(minutes)} label="Asleep" />
        <Stat value={String(estimateCycles(minutes))} label="Cycles" />
        {/* PLACEHOLDER: quality and stages aren't measured yet. */}
        <Stat value={`${PLACEHOLDER_QUALITY}/5`} label="Quality" />
      </View>
      <View style={styles.stageBar}>
        {[...PLACEHOLDER_STAGES, ...PLACEHOLDER_STAGES].map((s, i) => (
          <View key={i} style={{ flex: s.share, backgroundColor: STAGE_COLORS[s.stage] }} />
        ))}
      </View>
      <View style={styles.legend}>
        {PLACEHOLDER_STAGES.map((s) => (
          <View key={s.stage} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: STAGE_COLORS[s.stage] }]} />
            <Text style={styles.legendText}>{STAGE_LABELS[s.stage]} {Math.round(s.share * 100)}%</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

function History() {
  const sessions = useSleepStore((s) => s.sessions);
  const naps = useSleepStore((s) => s.naps);
  const sorted = [
    ...sessions.map((s) => ({ ...s, nap: false })),
    ...naps.map((n) => ({ ...n, nap: true })),
  ].sort((a, b) => b.endedAt.localeCompare(a.endedAt));
  if (!sorted.length) {
    return (
      <Card>
        <Text style={[styles.muted, styles.emptyText]}>Your past nights and naps will show up here.</Text>
      </Card>
    );
  }
  return (
    <Card>
      {sorted.map((s, i) => (
        <View key={`${s.nap ? "nap" : "night"}-${s.id}`} style={[styles.historyRow, i > 0 && styles.historyDivider]}>
          <View style={styles.flex}>
            <Text style={styles.historyDate}>
              {new Date(Date.parse(s.endedAt)).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              {s.nap ? <Text style={styles.napTag}>  ·  Nap</Text> : null}
            </Text>
            <Text style={styles.muted}>
              {formatTime(Date.parse(s.startedAt))} – {formatTime(Date.parse(s.endedAt))}
            </Text>
          </View>
          <Text style={styles.historyValue}>{formatDuration(sessionMinutes(s))}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 18 },
  flex: { flex: 1 },
  title: { fontSize: 34, fontWeight: "800", color: colors.text, marginTop: 8 },
  cardGap: { gap: 18 },
  readyRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  moonTile: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  readyTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
  muted: { fontSize: 16, color: colors.textMuted },
  scheduleRow: { flexDirection: "row", backgroundColor: colors.background, borderRadius: 16 },
  cell: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 2 },
  cellDivider: { borderLeftWidth: 2, borderLeftColor: colors.border },
  cellLabel: { fontSize: 14, color: colors.textMuted },
  cellValue: { fontSize: 18, fontWeight: "800", color: colors.text },
  editIcon: { position: "absolute", top: 8, right: 8 },
  pressed: { opacity: 0.6 },
  napButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  napButtonText: { fontSize: 15, fontWeight: "700", color: colors.primary },
  napTag: { fontWeight: "700", color: colors.primary },
  napValue: { fontSize: 16, fontWeight: "800", color: colors.text, marginRight: 14 },
  pill: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14 },
  pillText: { flex: 1, fontSize: 16, fontWeight: "700" },
  cardTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  emptyText: { marginTop: 8 },
  lastHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statsRow: { flexDirection: "row", gap: 40, marginTop: 16 },
  statValue: { fontSize: 28, fontWeight: "800", color: colors.text },
  stageBar: { flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden", gap: 2, marginTop: 20 },
  legend: { flexDirection: "row", gap: 20, marginTop: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 15, color: colors.textMuted },
  historyRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  historyDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  historyDate: { fontSize: 16, fontWeight: "700", color: colors.text },
  historyValue: { fontSize: 18, fontWeight: "800", color: colors.text },
});
