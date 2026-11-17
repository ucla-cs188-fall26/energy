import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { authStyles, BackButton } from "@/features/onboarding/components/AuthParts";
import { PrimaryButton } from "@/features/onboarding/components/PrimaryButton";
import { ERROR_COLOR, TextField } from "@/features/onboarding/components/TextField";
import { requestPasswordReset } from "@/services/auth";
import { colors } from "@/utils/theme";

const backToLogin = () => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"));

export default function ForgotPassword() {
  // Prefilled when opened from the Log in screen with an email already typed.
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit() {
    if (busy || !email.trim()) return;
    setBusy(true);
    setError("");
    try {
      await requestPasswordReset(email);
      setSentTo(email.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send the reset email.");
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content, styles.sent]}>
          <View style={styles.iconTile}>
            <Ionicons name="mail-unread-outline" size={36} color={colors.primary} />
          </View>
          <Text style={authStyles.title} accessibilityRole="header">Check your email</Text>
          <Text style={authStyles.subtitle}>
            If an account exists for <Text style={styles.bold}>{sentTo}</Text>, we sent a link to reset
            your password. Open it on this device.
          </Text>
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
        </View>
        <View style={styles.footer}>
          <PrimaryButton title="Back to log in" onPress={backToLogin} />
          <Text style={authStyles.footerText}>
            Didn’t get it?{" "}
            <Text style={authStyles.link} accessibilityRole="link" disabled={busy} onPress={submit}>
              {busy ? "Sending…" : "Send again"}
            </Text>
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackButton fallback="/(auth)/login" />
          <View style={[styles.iconTile, styles.iconSpacing]}>
            <Ionicons name="key-outline" size={34} color={colors.primary} />
          </View>
          <Text style={[authStyles.title, styles.title]} accessibilityRole="header">Forgot your password?</Text>
          <Text style={authStyles.subtitle}>
            Enter the email you signed up with and we’ll send you a link to reset it.
          </Text>

          <View style={styles.form}>
            <TextField label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email"
              textContentType="emailAddress" editable={!busy} returnKeyType="send" onSubmitEditing={submit} />
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton title="Send reset link" loading={busy} disabled={!email.trim()} onPress={submit} />
          <Text style={authStyles.footerText}>
            Remembered it?{" "}
            <Text style={authStyles.link} accessibilityRole="link" onPress={backToLogin}>Log in</Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
  iconTile: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconSpacing: { marginTop: 20 },
  title: { marginTop: 24, marginBottom: 8 },
  form: { marginTop: 32, gap: 16 },
  error: { fontSize: 15, color: ERROR_COLOR },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8, gap: 16 },
  sent: { justifyContent: "center", gap: 14 },
  bold: { fontWeight: "700", color: colors.text },
});
