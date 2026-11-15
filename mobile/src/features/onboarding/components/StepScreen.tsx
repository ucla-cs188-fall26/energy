import { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/utils/theme";
import { PrimaryButton } from "./PrimaryButton";
import { StepHeader } from "./StepHeader";

type Props = PropsWithChildren<{
  step: number;
  title: string;
  subtitle: string;
  buttonTitle?: string;
  canContinue?: boolean;
  onContinue: () => void;
  onSkip: () => void;
}>;

/** Shared layout for onboarding steps: header, title, scrolling body, bottom button. */
export function StepScreen({
  step, title, subtitle, buttonTitle = "Next", canContinue = true, onContinue, onSkip, children,
}: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <StepHeader step={step} onSkip={onSkip} />
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.body}>{children}</View>
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton title={buttonTitle} disabled={!canContinue} onPress={onContinue} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export const stepStyles = StyleSheet.create({
  sectionLabel: { fontSize: 20, fontWeight: "800", color: colors.text },
  fieldLabel: { fontSize: 16, fontWeight: "700", color: colors.text },
  helper: { fontSize: 15, lineHeight: 21, color: colors.textMuted },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  header: { paddingHorizontal: 24 },
  content: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: "800", color: colors.text },
  subtitle: { marginTop: 10, fontSize: 17, lineHeight: 24, color: colors.textMuted },
  body: { marginTop: 28 },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
});
