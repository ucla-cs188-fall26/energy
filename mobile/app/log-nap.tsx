import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { PrimaryButton } from "@/features/onboarding/components/PrimaryButton";
import { Segmented } from "@/features/onboarding/components/Segmented";
import { formatDuration, formatTime } from "@/features/schedule";
import { useSleepStore } from "@/features/sleep/store";
import { colors } from "@/utils/theme";

const MINUTE = 60_000;
const STEP_MINUTES = 5;
const MIN_NAP_MINUTES = 5;
const MAX_NAP_MINUTES = 4 * 60;
/** How far back a past nap can start. */
const LOOKBACK_MINUTES = 24 * 60;

/** "2:10 PM", or "Yesterday, 11:40 PM" when it isn't today. */
function formatNapTime(ms: number, today: number) {
  const sameDay = new Date(ms).toDateString() === new Date(today).toDateString();
  return sameDay ? formatTime(ms) : `Yesterday, ${formatTime(ms)}`;
}

function TimeStepRow({ icon, label, value, today, canDecrease, canIncrease, onChange }: {
  icon: "moon-outline" | "sunny-outline"; label: string; value: number; today: number;
  canDecrease: boolean; canIncrease: boolean; onChange: (deltaMinutes: number) => void;
}) {
  return (
    <View style={styles.timeRow}>
      <Ionicons name={icon} size={24} color={icon === "moon-outline" ? colors.primary : "#B8600B"} />
      <View style={styles.flex}>
        <Text style={styles.timeLabel}>{label}</Text>
        <Text style={styles.timeValue}>{formatNapTime(value, today)}</Text>
      </View>
      {([[-STEP_MINUTES, "remove", canDecrease, "Earlier"], [STEP_MINUTES, "add", canIncrease, "Later"]] as const).map(
        ([delta, iconName, enabled, word]) => (
          <Pressable
            key={iconName}
            accessibilityRole="button"
            accessibilityLabel={`${word} ${label.toLowerCase()}`}
            accessibilityState={{ disabled: !enabled }}
            disabled={!enabled}
            onPress={() => onChange(delta)}
            style={({ pressed }) => [styles.stepper, pressed && styles.pressed, !enabled && styles.stepperDisabled]}
          >
            <Ionicons name={iconName} size={22} color={colors.primary} />
          </Pressable>
        ))}
    </View>
  );
}

type Mode = "start" | "past";

/** Required 1–5 "how refreshed did you feel" rating for a past nap. */
function RefreshedRating({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.ratingBlock}>
      <Text style={styles.section}>How refreshed did you feel afterwards?</Text>
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((r) => (
          <Chip key={r} label={String(r)} selected={value === r} onPress={() => onChange(r)} />
        ))}
      </View>
      <View style={styles.ratingScale}>
        <Text style={styles.scaleText}>Groggy</Text>
        <Text style={styles.scaleText}>Refreshed</Text>
      </View>
    </View>
  );
}

export default function NapScreen() {
  const { logNap, startNap, activeNap } = useSleepStore();
  const [mode, setMode] = useState<Mode>("start");
  const [saving, setSaving] = useState(false);
  const [rating, setRating] = useState<number | undefined>();
  // Fixed when the sheet opens so limits don't drift while choosing.
  const [openedAt] = useState(Date.now);
  // Default: a 20-minute nap that just ended, on 5-minute marks.
  const [end, setEnd] = useState(() => Math.floor(openedAt / (STEP_MINUTES * MINUTE)) * STEP_MINUTES * MINUTE);
  const [start, setStart] = useState(() => end - 20 * MINUTE);
  const length = (end - start) / MINUTE;
  const step = STEP_MINUTES * MINUTE;

  async function action(work: () => Promise<void>, close = true) {
    if (saving) return;
    setSaving(true);
    try { await work(); if (close) router.back(); }
    catch (e) { Alert.alert("Unable to save nap", e instanceof Error ? e.message : "Please try again."); }
    finally { setSaving(false); }
  }

  const save = () => action(() => logNap({
    startedAt: new Date(start).toISOString(), endedAt: new Date(end).toISOString(), quality: rating,
  }));

  // A running nap lives on the dark Napping screen.
  useEffect(() => { if (activeNap) router.replace("/napping"); }, [activeNap]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <Header title="Nap" />
      <View style={styles.switcher}>
        <Segmented<Mode>
          accessibilityLabel="Nap options"
          options={[{ value: "start", label: "Start a nap" }, { value: "past", label: "Log a past nap" }]}
          value={mode}
          onChange={setMode}
          variant="light"
        />
      </View>

      {mode === "start" ? (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <Card style={styles.center}>
              <View style={styles.iconTile}>
                <Ionicons name="timer-outline" size={30} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>Ready for a nap?</Text>
              <View style={styles.tip}>
                <Ionicons name="bulb-outline" size={18} color={colors.primary} />
                <Text style={styles.tipText}>Naps of 20–30 minutes usually avoid grogginess.</Text>
              </View>
            </Card>
            <Pressable accessibilityRole="button" onPress={() => setMode("past")} style={styles.altLink}>
              <Text style={styles.altText}>Already napped? <Text style={styles.link}>Log a past nap</Text></Text>
            </Pressable>
          </ScrollView>
          <View style={styles.footer}>
            <PrimaryButton title="Start nap" loading={saving} onPress={() => action(startNap, false)} />
          </View>
        </>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.section}>When did you nap?</Text>
            <Card style={styles.rangeCard}>
              <TimeStepRow icon="moon-outline" label="Start time" value={start} today={openedAt}
                canDecrease={length + STEP_MINUTES <= MAX_NAP_MINUTES && start - step >= openedAt - LOOKBACK_MINUTES * MINUTE}
                canIncrease={length - STEP_MINUTES >= MIN_NAP_MINUTES}
                onChange={(d) => setStart(start + d * MINUTE)} />
              <View style={styles.divider} />
              <TimeStepRow icon="sunny-outline" label="End time" value={end} today={openedAt}
                canDecrease={length - STEP_MINUTES >= MIN_NAP_MINUTES}
                canIncrease={length + STEP_MINUTES <= MAX_NAP_MINUTES && end + step <= openedAt}
                onChange={(d) => setEnd(end + d * MINUTE)} />
              <View style={styles.summary}>
                <Text style={styles.summaryLabel}>Nap length</Text>
                <Text style={styles.summaryText}>{formatDuration(length)}</Text>
              </View>
            </Card>

            <RefreshedRating value={rating} onChange={setRating} />
          </ScrollView>
          <View style={styles.footer}>
            <PrimaryButton title="Save nap" loading={saving} disabled={rating == null} onPress={save} />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function Header({ title }: { title: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
        <Ionicons name="close" size={26} color={colors.textMuted} />
      </Pressable>
    </View>
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
  switcher: { paddingHorizontal: 20, paddingTop: 8 },
  content: { padding: 20, gap: 14 },
  center: { alignItems: "center", gap: 10, paddingVertical: 28 },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  cardTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
  tip: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
  },
  tipText: { flexShrink: 1, fontSize: 15, color: colors.text },
  altLink: { alignItems: "center", paddingVertical: 8 },
  altText: { fontSize: 16, color: colors.textMuted },
  link: { color: colors.primary, fontWeight: "700" },
  section: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: 8 },
  rangeCard: { gap: 14, padding: 16 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  flex: { flex: 1 },
  timeLabel: { fontSize: 15, color: colors.textMuted },
  timeValue: { fontSize: 20, fontWeight: "800", color: colors.text },
  stepper: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7 },
  stepperDisabled: { opacity: 0.35 },
  divider: { height: 1, backgroundColor: colors.border },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.background,
  },
  summaryLabel: { fontSize: 16, color: colors.textMuted },
  summaryText: { fontSize: 16, fontWeight: "800", color: colors.text },
  ratingBlock: { gap: 10 },
  ratingRow: { flexDirection: "row", justifyContent: "space-between" },
  ratingScale: { flexDirection: "row", justifyContent: "space-between" },
  scaleText: { fontSize: 13, color: colors.textMuted },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
});
