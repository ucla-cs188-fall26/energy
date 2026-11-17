import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatDuration, formatTime, greeting } from "@/features/schedule";
import { MoonArt, night, NightButton } from "@/features/sleep/dark";
import { RatingKind, ratingPrompt, usePendingRating } from "@/features/sleep/rating";
import { sessionMinutes, useSleepStore } from "@/features/sleep/store";

const LABELS: Record<number, string> = { 1: "Groggy", 2: "Tired", 3: "Okay", 4: "Good", 5: "Refreshed" };

/**
 * Full-screen "How refreshed do you feel?" question after a sleep or nap.
 * It can't be dismissed without answering: no swipe-down (set in the root
 * layout) and the Android back button is blocked.
 */
export default function RateSessionScreen() {
  const params = useLocalSearchParams<{ kind?: RatingKind; id?: string }>();
  const pending = usePendingRating();
  const { sessions, naps, rateSleep, rateNap } = useSleepStore();
  const [rating, setRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Rate the session we were opened for; otherwise whichever one is waiting.
  const kind: RatingKind = params.kind ?? pending?.kind ?? "sleep";
  const session = (kind === "nap" ? naps : sessions).find((s) => s.id === params.id) ?? pending?.session ?? null;

  useEffect(() => {
    ratingPrompt.open = true;
    const sub = BackHandler?.addEventListener?.("hardwareBackPress", () => true);
    return () => { ratingPrompt.open = false; sub?.remove(); };
  }, []);

  const leave = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  async function save() {
    if (!session || rating == null || saving) return;
    setSaving(true);
    try {
      await (kind === "nap" ? rateNap(session.id, rating) : rateSleep(session.id, rating));
      leave();
    } catch (e) {
      // Don't trap the user if the backend is unreachable; we'll ask again next time.
      Alert.alert("Couldn’t save your rating", e instanceof Error ? e.message : "Please try again.", [
        { text: "Try again", style: "cancel" },
        { text: "Ask me later", onPress: leave },
      ]);
    } finally {
      setSaving(false);
    }
  }

  const minutes = session ? sessionMinutes(session) : null;
  // Greet by when they actually woke up (e.g. "Good afternoon" after a late sleep).
  const title = kind === "nap" ? "Nap complete" : greeting(session ? Date.parse(session.endedAt) : Date.now());
  const summary = session && minutes != null
    ? `${kind === "nap" ? "You napped" : "You slept"} ${formatDuration(minutes)} · ${formatTime(Date.parse(session.startedAt))} – ${formatTime(Date.parse(session.endedAt))}`
    : null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <MoonArt size={110} />
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        {summary ? <Text style={styles.summary}>{summary}</Text> : null}

        <Text style={styles.question}>How refreshed do you feel?</Text>
        <View style={styles.row} accessibilityRole="radiogroup">
          {[1, 2, 3, 4, 5].map((r) => {
            const selected = rating === r;
            return (
              <Pressable
                key={r}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${r}, ${LABELS[r]}`}
                onPress={() => setRating(r)}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{r}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.scale}>
          <Text style={styles.scaleText}>Groggy</Text>
          <Text style={styles.scaleText}>Refreshed</Text>
        </View>
        <Text style={styles.chosen}>{rating != null ? LABELS[rating] : " "}</Text>
      </View>

      <View style={styles.footer}>
        <NightButton title={saving ? "Saving…" : "Save"} disabled={rating == null || saving || !session} onPress={save} />
        <Text style={styles.hint}>Your answer helps tune your energy estimates.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: night.bg, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  title: { marginTop: 16, fontSize: 30, fontWeight: "800", color: night.text },
  summary: { fontSize: 16, color: night.muted, textAlign: "center" },
  question: { marginTop: 36, marginBottom: 8, fontSize: 22, fontWeight: "700", color: night.text },
  row: { flexDirection: "row", gap: 10 },
  option: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: night.panel,
    borderWidth: 2,
    borderColor: night.barTrack,
    alignItems: "center",
    justifyContent: "center",
  },
  optionSelected: { backgroundColor: night.bar, borderColor: night.bar },
  optionText: { fontSize: 22, fontWeight: "800", color: night.text },
  optionTextSelected: { color: night.bg },
  scale: { flexDirection: "row", justifyContent: "space-between", width: 320, marginTop: 6 },
  scaleText: { fontSize: 14, color: night.muted },
  chosen: { marginTop: 10, fontSize: 18, fontWeight: "700", color: night.moon },
  footer: { paddingBottom: 8, gap: 14 },
  hint: { textAlign: "center", fontSize: 15, color: night.muted },
});
