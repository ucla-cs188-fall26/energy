import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EnergyRing } from "@/components/EnergyRing";
import { QuickAction } from "@/components/QuickAction";
import { StatCard } from "@/components/StatCard";
import { colors, spacing } from "@/utils/theme";

// Placeholder values — these will come from real logging + the math engine in later steps.
const placeholder = {
  energy: 82,
  steadyEnergyLeft: "~6h 30m",
  sleep: "7h 42m",
  caffeineMg: 120,
};

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.appName}>EnergySync</Text>
          <Ionicons name="person-outline" size={24} color={colors.primary} />
        </View>

        <View style={styles.ringWrap}>
          <EnergyRing percent={placeholder.energy} />
          <Text style={styles.status}>You're in a good spot!</Text>
          <Text style={styles.statusSub}>
            {placeholder.steadyEnergyLeft} of steady energy left
          </Text>
        </View>

        <View style={styles.row}>
          <StatCard icon="bed-outline" label="Sleep" value={placeholder.sleep} />
          <StatCard icon="cafe-outline" label="Caffeine" value={`${placeholder.caffeineMg} mg`} />
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.row}>
          <QuickAction icon="cafe-outline" label="Log Caffeine" onPress={() => router.navigate("/caffeine")} />
          <QuickAction icon="moon-outline" label="Start Sleep" onPress={() => router.navigate("/sleep")} />
          <QuickAction icon="bed-outline" label="Log Nap" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  appName: { fontSize: 22, fontWeight: "700", color: colors.text },
  ringWrap: { alignItems: "center", paddingVertical: spacing.md, gap: spacing.xs },
  status: { fontSize: 16, fontWeight: "600", color: colors.text, marginTop: spacing.md },
  statusSub: { fontSize: 14, color: colors.textMuted },
  row: { flexDirection: "row", gap: spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: spacing.sm },
});
