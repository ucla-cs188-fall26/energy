import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { BodyDetailsFields, useBodyDetailsForm } from "@/features/onboarding/components/BodyDetailsForm";
import { StepScreen, stepStyles } from "@/features/onboarding/components/StepScreen";
import { useOnboardingStore } from "@/features/onboarding/store";
import { colors } from "@/utils/theme";

const goNext = () => router.push("/(auth)/signup");

export default function AboutYouStep() {
  const { sex, units, ageYears, weightKg, heightCm, set } = useOnboardingStore();
  const form = useBodyDetailsForm({ sex, units, ageYears, weightKg, heightCm });

  return (
    <StepScreen
      step={4}
      title="A bit about you"
      subtitle="Sex, age and body size change how fast caffeine wears off."
      buttonTitle="Continue"
      canContinue={form.valid}
      onContinue={() => { set(form.values); goNext(); }}
      onSkip={() => { set({ sex: null, ageYears: null, weightKg: null, heightCm: null }); goNext(); }}
    >
      <BodyDetailsFields form={form} />

      <View style={styles.privacy}>
        <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
        <Text style={[stepStyles.helper, styles.privacyText]}>
          These details are saved with your profile. You can change them anytime in your account.
        </Text>
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  privacy: { marginTop: 20, flexDirection: "row", gap: 10 },
  privacyText: { flex: 1 },
});
