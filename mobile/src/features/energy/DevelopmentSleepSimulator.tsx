import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useDevelopmentSimulation } from "@/services/development-simulation";
import { useTrackingSync } from "@/services/tracking-sync";
import { trackingScope } from "@/services/tracking-scope";
import { colors } from "@/utils/theme";

const DURATIONS = [[30, "30 minutes"], [60, "1 hour"], [240, "4 hours"], [360, "6 hours"], [480, "8 hours"]] as const;

export function DevelopmentSleepSimulator() {
  const [expanded, setExpanded] = useState(false);
  const { prediction, scope, loading, error, simulate, reset } = useDevelopmentSimulation();
  if (typeof __DEV__ === "undefined" || !__DEV__) return null;
  const preview = scope === trackingScope.version && prediction;
  return <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 10 }}>
    <Text style={{ color: colors.textMuted, fontSize: 12 }}>Development · temporary preview only</Text>
    <Pressable accessibilityRole="button" onPress={() => setExpanded(!expanded)}>
      <Text style={{ color: colors.primary, fontWeight: "700" }}>Simulate Sleep</Text>
    </Pressable>
    {expanded ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {DURATIONS.map(([minutes, label]) => <Pressable key={minutes} accessibilityRole="button"
        disabled={loading} onPress={async () => { if (await simulate(minutes)) setExpanded(false); }}
        style={{ backgroundColor: colors.primarySoft, borderRadius: 12, padding: 10, opacity: loading ? .5 : 1 }}>
        <Text style={{ color: colors.primary }}>{label}</Text>
      </Pressable>)}
    </View> : null}
    {loading ? <ActivityIndicator accessibilityLabel="Calculating simulation" color={colors.primary} /> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.textMuted }}>{error}</Text> : null}
    {preview || loading ? <Pressable accessibilityRole="button" onPress={() => {
      reset(); setExpanded(false); void useTrackingSync.getState().refresh();
    }}><Text style={{ color: colors.primary, fontWeight: "700" }}>Reset Simulation</Text></Pressable> : null}
  </View>;
}
