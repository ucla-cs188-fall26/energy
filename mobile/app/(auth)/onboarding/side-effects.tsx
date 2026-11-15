import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StepScreen } from "@/features/onboarding/components/StepScreen";
import { SideEffect, useOnboardingStore } from "@/features/onboarding/store";
import { colors } from "@/utils/theme";

const OPTIONS: { value: SideEffect; label: string }[] = [
  { value: "jitters", label: "Jitters or restlessness" },
  { value: "anxiety", label: "Anxiety or stress" },
  { value: "headaches", label: "Headaches" },
  { value: "sleep_disruption", label: "Trouble sleeping" },
  { value: "stomach_upset", label: "Upset stomach" },
  { value: "energy_crash", label: "Energy crash later" },
];

const goNext = () => router.push("/(auth)/onboarding/sleep");

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.box, checked && styles.boxChecked]}>
      {checked ? <Ionicons name="checkmark" size={18} color={colors.surface} /> : null}
    </View>
  );
}

export default function SideEffectsStep() {
  const selected = useOnboardingStore((s) => s.sideEffects);
  const set = useOnboardingStore((s) => s.set);
  const noneChecked = selected !== null && selected.length === 0;

  const toggle = (value: SideEffect) => {
    const current = selected ?? [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    // Unchecking the last effect returns to "unanswered", not "None of these".
    set({ sideEffects: next.length ? next : null });
  };

  return (
    <StepScreen
      step={2}
      title="Does caffeine ever affect you like this?"
      subtitle="Select all that apply. We use this to tailor your daily caffeine suggestions."
      canContinue={selected !== null}
      onContinue={goNext}
      onSkip={() => { set({ sideEffects: null }); goNext(); }}
    >
      <View style={styles.grid}>
        {OPTIONS.map((o) => {
          const checked = !!selected?.includes(o.value);
          return (
            <Pressable
              key={o.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={o.label}
              onPress={() => toggle(o.value)}
              style={[styles.tile, checked && styles.checked]}
            >
              <Checkbox checked={checked} />
              <Text style={styles.label}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: noneChecked }}
        onPress={() => set({ sideEffects: noneChecked ? null : [] })}
        style={[styles.noneRow, noneChecked && styles.checked]}
      >
        <Checkbox checked={noneChecked} />
        <Text style={styles.label}>None of these</Text>
      </Pressable>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 },
  tile: {
    width: "48%",
    minHeight: 120,
    padding: 16,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "space-between",
    gap: 12,
  },
  checked: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  noneRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: { fontSize: 17, lineHeight: 22, fontWeight: "700", color: colors.text },
  box: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#A9A6B8",
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
});
