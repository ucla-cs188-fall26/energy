import { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "@/features/onboarding/components/AuthParts";
import { PrimaryButton } from "@/features/onboarding/components/PrimaryButton";
import { ERROR_COLOR } from "@/features/onboarding/components/TextField";
import { colors } from "@/utils/theme";

type Props = PropsWithChildren<{
  title: string;
  subtitle?: string;
  canSave: boolean;
  saving: boolean;
  error: string | null;
  onSave: () => void;
}>;

/** Layout for settings editors: back button, title, scrolling form, Save button. */
export function EditScreen({ title, subtitle, canSave, saving, error, onSave, children }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackButton fallback="/(tabs)" />
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.body}>{children}</View>
        </ScrollView>
        <View style={styles.footer}>
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <PrimaryButton title="Save" disabled={!canSave} loading={saving} onPress={onSave} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  title: { marginTop: 12, fontSize: 32, fontWeight: "800", color: colors.text },
  subtitle: { marginTop: 8, fontSize: 17, lineHeight: 24, color: colors.textMuted },
  body: { marginTop: 24 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 10 },
  error: { fontSize: 15, color: ERROR_COLOR, textAlign: "center" },
});
