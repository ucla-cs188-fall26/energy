import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Segmented } from "@/features/onboarding/components/Segmented";
import { SleepScheduleCard } from "@/features/onboarding/components/SleepScheduleCard";
import { StepScreen, stepStyles } from "@/features/onboarding/components/StepScreen";
import {
  CAFFEINE_CUTOFF_HOURS, CaffeineSensitivity, formatClock, initialAnswers, useOnboardingStore,
} from "@/features/onboarding/store";
import { colors } from "@/utils/theme";

const SENSITIVITY: { value: CaffeineSensitivity; label: string; helper: string }[] = [
  { value: "low", label: "Low", helper: "Coffee rarely affects your sleep." },
  { value: "medium", label: "Medium", helper: "A late coffee sometimes keeps you up." },
  { value: "high", label: "High", helper: "Even an afternoon coffee can keep you up." },
];

const goNext = () => router.push("/(auth)/onboarding/about-you");

export default function SleepStep() {
  const { bedtimeMinutes, wakeMinutes, sensitivity, set } = useOnboardingStore();
  const cutoff = bedtimeMinutes - CAFFEINE_CUTOFF_HOURS[sensitivity] * 60;
  const helper = SENSITIVITY.find((s) => s.value === sensitivity)!.helper;

  return (
    <StepScreen
      step={3}
      title="Your sleep routine"
      subtitle="This sets your energy forecast and bedtime reminders."
      buttonTitle="Continue"
      onContinue={goNext}
      onSkip={() => {
        const { bedtimeMinutes: b, wakeMinutes: w, sensitivity: s } = initialAnswers;
        set({ bedtimeMinutes: b, wakeMinutes: w, sensitivity: s });
        goNext();
      }}
    >
      <SleepScheduleCard bedtimeMinutes={bedtimeMinutes} wakeMinutes={wakeMinutes} onChange={set} />

      <Text style={[stepStyles.sectionLabel, styles.sensitivityLabel]}>Caffeine sensitivity</Text>
      <Segmented
        accessibilityLabel="Caffeine sensitivity"
        options={SENSITIVITY}
        value={sensitivity}
        onChange={(value) => set({ sensitivity: value })}
      />
      <Text style={[stepStyles.helper, styles.helper]}>{helper}</Text>

      <View style={styles.cutoff}>
        <Ionicons name="time-outline" size={24} color={colors.primary} />
        <Text style={styles.cutoffText}>
          Suggested last caffeine: <Text style={styles.cutoffTime}>by {formatClock(cutoff)}</Text>
        </Text>
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  sensitivityLabel: { marginTop: 32, marginBottom: 14 },
  helper: { marginTop: 14 },
  cutoff: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
  },
  cutoffText: { flex: 1, fontSize: 16, color: colors.text },
  cutoffTime: { fontWeight: "800", color: colors.primary },
});
