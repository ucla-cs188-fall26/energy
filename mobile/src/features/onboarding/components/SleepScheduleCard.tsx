import { Ionicons } from "@expo/vector-icons";
import { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  formatClock, formatDuration, SLEEP_STEP_MINUTES, sleepWindowMinutes, wrapMinutes,
} from "@/features/onboarding/store";
import { colors } from "@/utils/theme";

const SUN = "#B8600B";
const MIN_WINDOW = 3 * 60;
const MAX_WINDOW = 14 * 60;

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

type Props = {
  bedtimeMinutes: number;
  wakeMinutes: number;
  onChange: (next: { bedtimeMinutes: number; wakeMinutes: number }) => void;
};

/** Bedtime and wake-time steppers with the resulting sleep window (3–14 h). */
export function SleepScheduleCard({ bedtimeMinutes, wakeMinutes, onChange }: Props) {
  const sleepWindow = sleepWindowMinutes(bedtimeMinutes, wakeMinutes);
  const step = SLEEP_STEP_MINUTES;
  return (
    <View style={styles.card}>
      {/* Moving bedtime earlier lengthens the window; later shortens it. */}
      <TimeRow icon="moon-outline" iconColor={colors.primary} label="Bedtime" minutes={bedtimeMinutes}
        canDecrease={sleepWindow + step <= MAX_WINDOW} canIncrease={sleepWindow - step >= MIN_WINDOW}
        onChange={(d) => onChange({ bedtimeMinutes: wrapMinutes(bedtimeMinutes + d), wakeMinutes })} />
      <View style={styles.divider} />
      <TimeRow icon="sunny-outline" iconColor={SUN} label="Wake time" minutes={wakeMinutes}
        canDecrease={sleepWindow - step >= MIN_WINDOW} canIncrease={sleepWindow + step <= MAX_WINDOW}
        onChange={(d) => onChange({ bedtimeMinutes, wakeMinutes: wrapMinutes(wakeMinutes + d) })} />
      <View style={styles.windowPill}>
        <Text style={styles.windowLabel}>Sleep window</Text>
        <Text style={styles.windowValue}>{formatDuration(sleepWindow)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 2, borderColor: colors.border, borderRadius: 22, padding: 16, gap: 14, backgroundColor: colors.surface },
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
});
