import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StepScreen } from "@/features/onboarding/components/StepScreen";
import { CaffeineFrequency, useOnboardingStore } from "@/features/onboarding/store";
import { colors } from "@/utils/theme";

const OPTIONS: { value: CaffeineFrequency; title: string; body: string }[] = [
  { value: "daily", title: "Daily", body: "Most days, one or more drinks" },
  { value: "few_times_week", title: "A few times a week", body: "Some days, not every day" },
  { value: "rarely", title: "Rarely", body: "Once in a while" },
  { value: "never", title: "I don’t use caffeine", body: "We’ll focus on sleep and energy" },
];

const goNext = () => router.push("/(auth)/onboarding/side-effects");

export default function FrequencyStep() {
  const selected = useOnboardingStore((s) => s.caffeineFrequency);
  const set = useOnboardingStore((s) => s.set);

  return (
    <StepScreen
      step={1}
      title="How often do you have caffeine?"
      subtitle="Coffee, tea, energy drinks, soda – it all counts."
      canContinue={!!selected}
      onContinue={goNext}
      onSkip={() => { set({ caffeineFrequency: null }); goNext(); }}
    >
      <View style={styles.options} accessibilityRole="radiogroup">
        {OPTIONS.map((o) => {
          const checked = selected === o.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              onPress={() => set({ caffeineFrequency: o.value })}
              style={[styles.option, checked && styles.optionChecked]}
            >
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{o.title}</Text>
                <Text style={styles.optionBody}>{o.body}</Text>
              </View>
              <View style={[styles.radio, checked && styles.radioChecked]}>
                {checked ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  options: { gap: 14 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionChecked: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionText: { flex: 1, gap: 4 },
  optionTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  optionBody: { fontSize: 15, color: colors.textMuted },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#A9A6B8",
    alignItems: "center",
    justifyContent: "center",
  },
  radioChecked: { borderColor: colors.primary },
  radioDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary },
});
