import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { PrimaryButton } from "@/features/onboarding/components/PrimaryButton";
import { EnergyObservation, trackingApi } from "@/services/api";
import { trackingScope } from "@/services/tracking-scope";
import { colors } from "@/utils/theme";

export default function InsightsScreen() {
  const [rating, setRating] = useState<number | null>(null);
  const [items, setItems] = useState<EnergyObservation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useFocusEffect(useCallback(() => {
    let active = true;
    const scope = trackingScope.version;
    setBusy(true); setError("");
    void trackingApi.energyHistory().then(rows => { if (active && scope === trackingScope.version) setItems(rows); })
      .catch(() => { if (active) setError("Unable to load check-ins. Reopen this tab to retry."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []));
  async function save() {
    if (rating === null || busy) return;
    const scope = trackingScope.version;
    setBusy(true);
    try {
      const row = await trackingApi.checkin(rating);
      if (scope === trackingScope.version) { setItems(rows => [row, ...rows]); setRating(null); }
    } catch (e) { Alert.alert("Unable to save check-in", e instanceof Error ? e.message : "Try again."); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.safe} edges={["top"]}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Insights</Text>
      <Card style={styles.gap}>
        <Text style={styles.heading}>How energetic do you feel?</Text>
        <Text style={styles.muted}>1 = very low · 10 = very high. Your ratings are saved separately from estimated energy.</Text>
        <View style={styles.chips}>{Array.from({ length: 10 }, (_, i) => i + 1).map(r =>
          <Chip key={r} label={String(r)} selected={rating === r} onPress={() => setRating(r)} />)}</View>
        <PrimaryButton title="Save check-in" onPress={save} disabled={rating === null} loading={busy} />
      </Card>
      {error ? <Text accessibilityRole="alert" style={styles.muted}>{error}</Text> : null}
      <Card style={styles.gap}>
        <Text style={styles.heading}>Energy check-in history</Text>
        {!items.length ? <Text style={styles.muted}>{busy ? "Loading…" : "No check-ins yet."}</Text> : items.map(item =>
          <View key={item.id} style={styles.row}><Text style={styles.muted}>{new Date(item.recorded_at).toLocaleString()}</Text>
            <Text style={styles.heading}>{item.energy_rating}/10</Text></View>)}
      </Card>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, gap: 18 },
  title: { fontSize: 34, fontWeight: "800", color: colors.text, marginTop: 8 },
  heading: { fontSize: 18, fontWeight: "700", color: colors.text },
  muted: { fontSize: 16, color: colors.textMuted }, gap: { gap: 16 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
});
