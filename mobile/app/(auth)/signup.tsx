import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { authStyles, BackButton, PasswordField } from "@/features/onboarding/components/AuthParts";
import { PrimaryButton } from "@/features/onboarding/components/PrimaryButton";
import { ERROR_COLOR, TextField } from "@/features/onboarding/components/TextField";
import { useOnboardingStore } from "@/features/onboarding/store";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/utils/theme";

const MIN_PASSWORD = 8;
const SUCCESS = "#15803D";
const SUCCESS_SOFT = "#E7F6EC";

export default function SignupScreen() {
  const { signUp } = useAuth();
  const setAnswers = useOnboardingStore((s) => s.set);
  const [fullName, setFullName] = useState(useOnboardingStore.getState().fullName ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  const name = fullName.trim().replace(/\s+/g, " ");
  const canSubmit = !!name && !!email.trim() && password.length >= MIN_PASSWORD && !busy;

  async function submit() {
    setError("");
    setBusy(true);
    // Mark answers for saving before signUp: with email confirmation off, a
    // session (and the save) can start before signUp even returns.
    setAnswers({ fullName: name, signupEmail: email.trim(), pendingSync: true });
    try {
      const data = await signUp(email, password);
      if (!data.session) setSentTo(email.trim());
    } catch (cause) {
      setAnswers({ pendingSync: false });
      setError(cause instanceof Error ? cause.message : "Unable to create your account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.content, styles.sent]}>
          <View style={styles.sentIcon}>
            <Ionicons name="mail-unread-outline" size={36} color={colors.primary} />
          </View>
          <Text style={authStyles.title} accessibilityRole="header">Check your email</Text>
          <Text style={authStyles.subtitle}>
            We sent a confirmation link to <Text style={styles.bold}>{sentTo}</Text>. Open it on this
            device to finish creating your account.
          </Text>
        </View>
        <View style={styles.footer}>
          <PrimaryButton title="Go to log in" onPress={() => router.replace("/(auth)/login")} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackButton />
          <View style={styles.badge}>
            <Ionicons name="checkmark" size={16} color={SUCCESS} />
            <Text style={styles.badgeText}>Your plan is ready</Text>
          </View>
          <Text style={[authStyles.title, styles.title]} accessibilityRole="header">Create your account</Text>
          <Text style={authStyles.subtitle}>Save your profile and keep your sleep and caffeine history synced.</Text>

          <View style={styles.form}>
            <TextField label="Full name" placeholder="Alex Smith" value={fullName} onChangeText={setFullName}
              autoComplete="name" textContentType="name" autoCapitalize="words" maxLength={80}
              editable={!busy} />
            <TextField label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email"
              textContentType="emailAddress" editable={!busy} />
            <PasswordField placeholder={`At least ${MIN_PASSWORD} characters`} value={password}
              onChangeText={setPassword} autoComplete="new-password" textContentType="newPassword"
              editable={!busy} />

            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton title="Create account" disabled={!canSubmit} loading={busy} onPress={submit} />
          <Text style={authStyles.footerText}>
            Already have an account?{" "}
            <Text style={authStyles.link} accessibilityRole="link" onPress={() => router.push("/(auth)/login")}>
              Log in
            </Text>
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
  badge: {
    marginTop: 20,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: SUCCESS_SOFT,
  },
  badgeText: { fontSize: 15, fontWeight: "700", color: SUCCESS },
  title: { marginTop: 14, marginBottom: 10 },
  form: { marginTop: 28, gap: 20 },
  error: { fontSize: 15, color: ERROR_COLOR },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8, gap: 16 },
  sent: { justifyContent: "center", gap: 14 },
  sentIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  bold: { fontWeight: "700", color: colors.text },
});
