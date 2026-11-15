import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { EnergyRing } from "@/components/EnergyRing";
import { QuickAction } from "@/components/QuickAction";
import { StatCard } from "@/components/StatCard";
import { useCaffeineSummary } from "@/features/caffeine/useCaffeineSummary";
import { energyStatus, homeForecast } from "@/features/energy/forecast";
import { ForecastChart } from "@/features/energy/ForecastChart";
import { useProfileSettings } from "@/features/profile/store";
import { formatDuration, formatHour, formatTime, wakingDay } from "@/features/schedule";
import { PLACEHOLDER_QUALITY, sessionMinutes, useLastSleep, useSleepStore } from "@/features/sleep/store";
import { useNow } from "@/hooks/useNow";
import { colors } from "@/utils/theme";

const DIP_COLOR = "#B45309";

function greeting(now: number) {
  const h = new Date(now).getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function HomeScreen() {
  const now = useNow();
  const { firstName, name, wakeMinutes, bedtimeMinutes } = useProfileSettings();
  const caffeine = useCaffeineSummary(now);
  const lastSleep = useLastSleep();
  const startSleep = useSleepStore((s) => s.startSleep);

  const { wake, bedtime } = wakingDay(wakeMinutes, bedtimeMinutes, now);
  const energy = homeForecast(now, wake, bedtime);
  const steady = energy.steadyHours != null && energy.steadyHours >= 0.5
    ? `Steady energy for about ${formatDuration(Math.round(energy.steadyHours * 2) * 30)}. ` : "";
  const outlook = energy.night
    ? `Get some rest. Tomorrow’s forecast starts at ${formatTime(energy.start)}.`
    : energy.dip != null
      ? `${steady}A dip is likely around ${formatTime(energy.dip)}.`
      : "Your energy will wind down toward bedtime.";

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

        <Card>
          <View style={styles.energyRow}>
            <EnergyRing percent={energy.now} />
            <View style={styles.energyText}>
              <Text style={styles.status}>{energy.night ? "It’s past your bedtime" : energyStatus(energy.now)}</Text>
              <Text style={styles.statusSub}>{outlook}</Text>
            </View>
          </View>

          <View style={styles.forecastHeader}>
            <Text style={styles.forecastTitle}>{energy.night ? "Tomorrow’s forecast" : "Today’s forecast"}</Text>
            {energy.dip != null ? <Text style={styles.dip}>Dip ~{formatTime(energy.dip)}</Text> : null}
          </View>
          <ForecastChart forecast={energy} startLabel={energy.night ? formatHour(energy.start) : "Now"} />
        </Card>

        <View style={styles.row}>
          <StatCard
            icon="moon-outline"
            label="Last night"
            value={lastSleep ? formatDuration(sessionMinutes(lastSleep)) : "—"}
            detail={lastSleep ? `Quality ${PLACEHOLDER_QUALITY}/5` : "No sleep logged"}
          />
          <StatCard
            icon="cafe-outline"
            label="In system now"
            value={`${caffeine.inSystemMg} mg`}
            detail={`${caffeine.todayMg} mg today`}
          />
        </View>

        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.row}>
          <QuickAction icon="add" label="Log drink" onPress={() => router.push("/log-drink")} />
          <QuickAction icon="moon-outline" label="Start sleep" onPress={() => { startSleep(); router.push("/sleeping"); }} />
          <QuickAction icon="timer-outline" label="Log nap" onPress={() => router.push("/log-nap")} />
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
