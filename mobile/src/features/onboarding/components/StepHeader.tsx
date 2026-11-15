import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/utils/theme";

export const TOTAL_STEPS = 4;

type Props = { step: number; onSkip: () => void };

/** Back arrow, "Step X of 4", Skip, and the segmented progress bar. */
export function StepHeader({ step, onSkip }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.side}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.stepText}>Step {step} of {TOTAL_STEPS}</Text>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={onSkip} style={[styles.side, styles.right]}>
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>
      <View
        style={styles.progress}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: TOTAL_STEPS, now: step }}
      >
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <View key={i} style={[styles.segment, i < step && styles.segmentDone]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 20, paddingTop: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  side: { width: 60 },
  right: { alignItems: "flex-end" },
  stepText: { fontSize: 16, fontWeight: "600", color: colors.textMuted },
  skip: { fontSize: 17, fontWeight: "700", color: colors.primary },
  progress: { flexDirection: "row", gap: 8 },
  segment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border },
  segmentDone: { backgroundColor: colors.primary },
});
