import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { EnergyRing } from "@/components/EnergyRing";
import { QuickAction } from "@/components/QuickAction";
import { StatCard } from "@/components/StatCard";
import { useCaffeineSummary } from "@/features/caffeine/useCaffeineSummary";
import { energyStatus } from "@/features/energy/forecast";
import { ForecastChart } from "@/features/energy/ForecastChart";
import { useProfileSettings } from "@/features/profile/store";
import { formatDuration, greeting } from "@/features/schedule";
import { sessionMinutes, useLastSleep, useSleepStore } from "@/features/sleep/store";
import { useNow } from "@/hooks/useNow";
import { colors } from "@/utils/theme";

import { useTrackingSync } from "@/services/tracking-sync";
import { useTrackingRefresh } from "@/hooks/useTrackingRefresh";
import { DevelopmentSleepSimulator } from "@/features/energy/DevelopmentSleepSimulator";
import { useDevelopmentSimulation } from "@/services/development-simulation";
import { trackingScope } from "@/services/tracking-scope";
import { SyncStatus } from "@/components/SyncStatus";

const DIP_COLOR = "#B45309";

export default function HomeScreen() {
  const now = useNow();
  useTrackingRefresh();
  const actualPrediction = useTrackingSync(s => s.prediction);
  const preview = useDevelopmentSimulation(s => s.scope === trackingScope.version ? s.prediction : null);
  const simulation = typeof __DEV__ !== "undefined" && __DEV__ ? preview : null;
  const prediction = simulation ?? actualPrediction;
  const { firstName, name } = useProfileSettings();
  const caffeine = useCaffeineSummary(now);
  const lastSleep = useLastSleep();
  const activeSleep = useSleepStore(s => s.active);
  const startSleep = useSleepStore((s) => s.startSleep);

  const points = prediction ? [prediction, ...prediction.forecast]
    .filter(p => p.score !== null).map(p => ({ t: Date.parse(p.timestamp), value: p.score! })) : [];
  const energy = { now: prediction?.score ?? null, points, dip: null, steadyHours: null };
  const outlook = prediction?.status === "sleeping" ? "Sleep or nap session in progress."
    : prediction?.score != null ? "Estimated from your sleep, naps and caffeine."
    : "Record a completed night of sleep to estimate your energy.";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.date}>
              {new Date(now).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </Text>
            <Text style={styles.greeting} accessibilityRole="header">
              {greeting(now)}{firstName ? `, ${firstName}` : ""}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Account"
            onPress={() => router.push("/account")}
            style={styles.avatar}
          >
            {name
              ? <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
              : <Ionicons name="person" size={24} color={colors.primary} />}
          </Pressable>
        </View>

        <SyncStatus />
        <Card>
          {simulation ? <Text accessibilityRole="alert" style={{ color: colors.primary, fontWeight: "700", marginBottom: 12 }}>
            Simulation · {simulation.simulated_sleep_minutes} minutes of sleep · Not saved
          </Text> : null}
          <View style={styles.energyRow}>
            <EnergyRing percent={energy.now} />
            <View style={styles.energyText}>
              <Text style={styles.status}>{energy.now === null ? "Energy unavailable" : energyStatus(energy.now)}</Text>
              {outlook ? <Text style={styles.statusSub}>{outlook}</Text> : null}
            </View>
          </View>

          <View style={styles.forecastHeader}>
            <Text style={styles.forecastTitle}>Today’s forecast</Text>

          </View>
          <ForecastChart forecast={{ ...energy, now: energy.now ?? 0 }} emptyMessage={prediction?.status === "sleeping" ? "Stop the active sleep or nap session to see a forecast." : undefined} />
          {typeof __DEV__ !== "undefined" && __DEV__ ? <DevelopmentSleepSimulator /> : null}
        </Card>

        <View style={styles.row}>
          <StatCard
            icon="moon-outline"
            label="Last sleep"
            value={lastSleep ? formatDuration(sessionMinutes(lastSleep)) : "—"}
            detail={lastSleep ? (lastSleep.quality ? `Quality ${lastSleep.quality}/5` : "Not rated") : "No sleep logged"}
          />
          <StatCard
            icon="cafe-outline"
            label="In system now"
            // Same local calculation as the Caffeine and Sleep tabs, so every screen shows one number.
            // The backend computes the same value (checked in backend-contract.test.cjs) for the energy score.
            value={`${caffeine.inSystemMg} mg`}
            detail={`${caffeine.todayMg} mg today`}
          />
        </View>

        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.row}>
          <QuickAction icon="add" label="Log drink" onPress={() => router.push("/log-drink")} />
          <QuickAction icon="moon-outline" label={activeSleep ? "Resume sleep" : "Start sleep"} onPress={async () => { try { await startSleep(); router.push("/sleeping"); } catch (e) { Alert.alert("Unable to start sleep", e instanceof Error ? e.message : "Please try again."); } }} />
          <QuickAction icon="timer-outline" label="Log nap"
            onPress={() => router.push(useSleepStore.getState().activeNap ? "/napping" : "/log-nap")} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 18 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 },
  headerText: { flex: 1 },
  date: { fontSize: 17, color: colors.textMuted },
  greeting: { fontSize: 30, fontWeight: "800", color: colors.text, marginTop: 2 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 22, fontWeight: "800", color: colors.primary },
  energyRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  energyText: { flex: 1, gap: 6 },
  status: { fontSize: 22, fontWeight: "800", color: colors.text },
  statusSub: { fontSize: 16, lineHeight: 22, color: colors.textMuted },
  forecastHeader: { flexDirection: "row", justifyContent: "space-between", marginTop: 24, marginBottom: 10 },
  forecastTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  dip: { fontSize: 16, fontWeight: "700", color: DIP_COLOR },
  row: { flexDirection: "row", gap: 14 },
  sectionTitle: { fontSize: 22, fontWeight: "800", color: colors.text, marginTop: 4 },
});
