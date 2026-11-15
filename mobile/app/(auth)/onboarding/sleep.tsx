import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Segmented } from "@/features/onboarding/components/Segmented";
import { StepScreen, stepStyles } from "@/features/onboarding/components/StepScreen";
import {
  CAFFEINE_CUTOFF_HOURS, CaffeineSensitivity, formatClock, formatDuration, initialAnswers,
  SLEEP_STEP_MINUTES, sleepWindowMinutes, useOnboardingStore,
} from "@/features/onboarding/store";
import { colors } from "@/utils/theme";

const SUN = "#B8600B";
const MIN_WINDOW = 3 * 60;
const MAX_WINDOW = 14 * 60;

const SENSITIVITY: { value: CaffeineSensitivity; label: string; helper: string }[] = [
  { value: "low", label: "Low", helper: "Coffee rarely affects your sleep." },
  { value: "medium", label: "Medium", helper: "A late coffee sometimes keeps you up." },
  { value: "high", label: "High", helper: "Even an afternoon coffee can keep you up." },
];

const goNext = () => router.push("/(auth)/onboarding/about-you");

type RowProps = {
  icon: ComponentProps<typeof Ionicons>["name"];
  iconColor: string;
  label: string;
  minutes: number;
  canDecrease: boolean;
  canIncrease: boolean;
  onChange: (delta: number) => void;
};

function TimeRow({ icon, iconColor, label, minutes, canDecrease, canIncrease, onChange }: RowProps) {
  return (
    <View style={styles.timeRow}>
      <Ionicons name={icon} size={26} color={iconColor} />
      <View style={styles.timeText}>
        <Text style={styles.timeLabel}>{label}</Text>
        <Text style={styles.timeValue}>{formatClock(minutes)}</Text>
      </View>
      <StepperButton icon="remove" label={`Earlier ${label.toLowerCase()}`} disabled={!canDecrease}
        onPress={() => onChange(-SLEEP_STEP_MINUTES)} />
      <StepperButton icon="add" label={`Later ${label.toLowerCase()}`} disabled={!canIncrease}
        onPress={() => onChange(SLEEP_STEP_MINUTES)} />
    </View>
  );
}

function StepperButton({ icon, label, disabled, onPress }: {
  icon: "add" | "remove"; label: string; disabled: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.stepper, pressed && styles.stepperPressed, disabled && styles.stepperDisabled]}
    >
      <Ionicons name={icon} size={24} color={colors.primary} />
    </Pressable>
  );
}

export default function SleepStep() {
  const { bedtimeMinutes, wakeMinutes, sensitivity, set } = useOnboardingStore();
  const sleepWindow = sleepWindowMinutes(bedtimeMinutes, wakeMinutes);
  const step = SLEEP_STEP_MINUTES;
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
      <View style={styles.card}>
        {/* Moving bedtime earlier lengthens the window; later shortens it. */}
        <TimeRow icon="moon-outline" iconColor={colors.primary} label="Bedtime" minutes={bedtimeMinutes}
          canDecrease={sleepWindow + step <= MAX_WINDOW} canIncrease={sleepWindow - step >= MIN_WINDOW}
          onChange={(d) => set({ bedtimeMinutes: bedtimeMinutes + d })} />
        <View style={styles.divider} />
        <TimeRow icon="sunny-outline" iconColor={SUN} label="Wake time" minutes={wakeMinutes}
          canDecrease={sleepWindow - step >= MIN_WINDOW} canIncrease={sleepWindow + step <= MAX_WINDOW}
          onChange={(d) => set({ wakeMinutes: wakeMinutes + d })} />
        <View style={styles.windowPill}>
          <Text style={styles.windowLabel}>Sleep window</Text>
          <Text style={styles.windowValue}>{formatDuration(sleepWindow)}</Text>
        </View>
      </View>

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
  card: { borderWidth: 2, borderColor: colors.border, borderRadius: 22, padding: 16, gap: 14 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  timeText: { flex: 1 },
  timeLabel: { fontSize: 15, color: colors.textMuted },
  timeValue: { fontSize: 22, fontWeight: "800", color: colors.text },
  stepper: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperPressed: { opacity: 0.7 },
  stepperDisabled: { opacity: 0.35 },
  divider: { height: 1, backgroundColor: colors.border },
  windowPill: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.background,
  },
  windowLabel: { fontSize: 16, color: colors.textMuted },
  windowValue: { fontSize: 16, fontWeight: "800", color: colors.text },
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
