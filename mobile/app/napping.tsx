import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatDuration, formatTime } from "@/features/schedule";
import { MoonArt, night, NightButton } from "@/features/sleep/dark";
import { ratingPrompt } from "@/features/sleep/rating";
import { useSleepStore } from "@/features/sleep/store";
import { useNow } from "@/hooks/useNow";

const MINUTE = 60_000;
/** Typical short-nap window that avoids waking from deep sleep. */
const IDEAL_NAP = { from: 20, to: 30 };

export default function NappingScreen() {
  const now = useNow(1000);
  const activeNap = useSleepStore((s) => s.activeNap);
  const stopNap = useSleepStore((s) => s.stopNap);
  const [saving, setSaving] = useState(false);

  // Nothing to show if the nap was already stopped (e.g. from another device).
  useEffect(() => {
    if (!activeNap && !saving) router.canGoBack() ? router.back() : router.replace("/(tabs)/sleep");
  }, [activeNap, saving]);

  const started = activeNap ? Date.parse(activeNap.startedAt) : now;
  const elapsed = (now - started) / MINUTE;
  const pastIdeal = elapsed > IDEAL_NAP.to;

  const stop = async () => {
    if (!activeNap || saving) return;
    const id = activeNap.id;
    setSaving(true);
    ratingPrompt.open = true;
    try {
      await stopNap();
    } catch (e) {
      ratingPrompt.open = false;
      setSaving(false);
      Alert.alert("Unable to stop nap", e instanceof Error ? e.message : "Try again.");
      return;
    }
    router.replace({ pathname: "/rate-session", params: { kind: "nap", id } });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Text style={styles.clock}>{formatTime(now)}</Text>

      <View style={styles.center}>
        <MoonArt />
        <Text style={styles.label}>Napping</Text>
        <Text style={styles.elapsed} accessibilityLabel={`Napping for ${formatDuration(elapsed)}`}>
          {formatDuration(elapsed)}
        </Text>
        <Text style={styles.sub}>Started at {formatTime(started)}</Text>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>
            {pastIdeal ? "Longer naps can leave you groggy" : "Short naps work best"}
          </Text>
          <Text style={styles.panelMuted}>
            A {IDEAL_NAP.from}–{IDEAL_NAP.to} minute nap would end around{" "}
            {formatTime(started + IDEAL_NAP.from * MINUTE)}–{formatTime(started + IDEAL_NAP.to * MINUTE)}.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <NightButton title={saving ? "Saving…" : "Stop nap"} disabled={saving} onPress={stop} />
        <Text style={styles.hint}>Your nap is saved to your account</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: night.bg, paddingHorizontal: 24 },
  clock: { marginTop: 24, textAlign: "center", fontSize: 18, fontWeight: "700", color: night.muted },
  center: { flex: 1, alignItems: "center", paddingTop: 32 },
  label: { marginTop: 20, fontSize: 22, fontWeight: "700", color: night.muted },
  elapsed: { fontSize: 64, fontWeight: "800", color: night.text, letterSpacing: -1 },
  sub: { fontSize: 18, color: night.muted },
  panel: { alignSelf: "stretch", marginTop: 44, backgroundColor: night.panel, borderRadius: 24, padding: 20, gap: 10 },
  panelTitle: { fontSize: 17, fontWeight: "700", color: night.text },
  panelMuted: { fontSize: 16, lineHeight: 22, color: night.muted },
  footer: { paddingBottom: 8, gap: 14 },
  hint: { textAlign: "center", fontSize: 15, color: night.muted },
});
