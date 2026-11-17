import { useState } from "react";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import { useProfileSettings } from "@/features/profile/store";
import { formatDuration, formatTime, nextOccurrence } from "@/features/schedule";
import { ratingPrompt } from "@/features/sleep/rating";
import { CYCLE_MINUTES, useSleepStore } from "@/features/sleep/store";
import { sleepWindowMinutes } from "@/features/onboarding/store";
import { useNow } from "@/hooks/useNow";

const BG = "#15132B";
const PANEL = "#221F3D";
const MOON = "#CFC3F7";
const TEXT = "#EFEBFD";
const MUTED = "#A9A3CC";
const BAR = "#8B76F0";
const BAR_TRACK = "#3A355E";
const MINUTE = 60_000;
function MoonArt() {
  return (
    <Svg width={140} height={140} viewBox="0 0 100 100">
      <Circle cx={46} cy={54} r={32} fill={MOON} />
      <Circle cx={62} cy={40} r={28} fill={BG} />
      <Path d="M74 14 L76 20 L82 22 L76 24 L74 30 L72 24 L66 22 L72 20 Z" fill={MOON} />
      <Circle cx={86} cy={34} r={2.2} fill={MOON} />
    </Svg>
  );
}

export default function SleepingScreen() {
  const now = useNow(1000);
  const [saving, setSaving] = useState(false);
  const active = useSleepStore((s) => s.active);
  const stopSleep = useSleepStore((s) => s.stopSleep);
  const { bedtimeMinutes, wakeMinutes } = useProfileSettings();

  const started = active ? Date.parse(active.startedAt) : now;
  const elapsed = (now - started) / MINUTE;
  const alarm = nextOccurrence(wakeMinutes, started);
  const left = (alarm - now) / MINUTE;
  const totalCycles = Math.max(1, Math.round(sleepWindowMinutes(bedtimeMinutes, wakeMinutes) / CYCLE_MINUTES));
  const cycleIndex = Math.min(totalCycles - 1, Math.floor(elapsed / CYCLE_MINUTES));
  const cycleFraction = elapsed >= totalCycles * CYCLE_MINUTES ? 1 : (elapsed % CYCLE_MINUTES) / CYCLE_MINUTES;

  const stop = async () => {
    if (saving) return;
    setSaving(true);
    // This screen opens the rating question itself; keep the tab-level check from opening another.
    ratingPrompt.open = true;
    let session;
    try { session = await stopSleep(); } catch (e) {
      ratingPrompt.open = false;
      Alert.alert("Unable to stop sleep", e instanceof Error ? e.message : "Try again.");
      setSaving(false); return;
    }
    if (session) {
      router.replace({ pathname: "/rate-session", params: { kind: "sleep", id: session.id } });
      return;
    }
    ratingPrompt.open = false;
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/sleep");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.clock}>{formatTime(now)}</Text>

      <View style={styles.center}>
        <MoonArt />
        <Text style={styles.sleeping}>Sleeping</Text>
        <Text style={styles.elapsed} accessibilityLabel={`Asleep for ${formatDuration(elapsed)}`}>
          {formatDuration(elapsed)}
        </Text>
        <Text style={styles.alarm}>
          Planned wake {formatTime(alarm)} · {left > 0 ? `${formatDuration(left)} left` : "now"}
        </Text>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Sleep cycle {cycleIndex + 1} of {totalCycles}</Text>
            <Text style={styles.panelMuted}>90-min estimate</Text>
          </View>
          <View style={styles.cycles}>
            {Array.from({ length: totalCycles }, (_, i) => {
              const fill = i < cycleIndex ? 1 : i === cycleIndex ? cycleFraction : 0;
              return (
                <View key={i} style={styles.cycleTrack}>
                  <View style={[styles.cycleFill, { width: `${fill * 100}%` }]} />
                </View>
              );
            })}
          </View>
          <Text style={styles.panelMuted}>
            Progress is estimated from elapsed time; sleep stages are not measured.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={stop}
          style={({ pressed }) => [styles.stop, pressed && styles.stopPressed]}
        >
          <Text style={styles.stopText}>{saving ? "Saving…" : "Stop sleep"}</Text>
        </Pressable>
        <Text style={styles.hint}>Your session is saved to your account</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG, paddingHorizontal: 24 },
  clock: { marginTop: 24, textAlign: "center", fontSize: 18, fontWeight: "700", color: MUTED },
  center: { flex: 1, alignItems: "center", paddingTop: 32 },
  sleeping: { marginTop: 20, fontSize: 22, fontWeight: "700", color: MUTED },
  elapsed: { fontSize: 64, fontWeight: "800", color: TEXT, letterSpacing: -1 },
  alarm: { fontSize: 18, color: MUTED },
  panel: { alignSelf: "stretch", marginTop: 44, backgroundColor: PANEL, borderRadius: 24, padding: 20, gap: 14 },
  panelHeader: { flexDirection: "row", justifyContent: "space-between" },
  panelTitle: { fontSize: 17, fontWeight: "700", color: TEXT },
  panelMuted: { fontSize: 16, color: MUTED },
  cycles: { flexDirection: "row", gap: 6 },
  cycleTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: BAR_TRACK, overflow: "hidden" },
  cycleFill: { height: "100%", backgroundColor: BAR },
  footer: { paddingBottom: 8, gap: 14 },
  stop: { height: 60, borderRadius: 18, backgroundColor: TEXT, alignItems: "center", justifyContent: "center" },
  stopPressed: { opacity: 0.85 },
  stopText: { fontSize: 19, fontWeight: "800", color: BG },
  hint: { textAlign: "center", fontSize: 15, color: MUTED },
});
