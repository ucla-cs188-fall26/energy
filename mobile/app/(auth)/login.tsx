import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppLogo } from "@/features/onboarding/components/AppLogo";
import { authStyles, BackButton, PasswordField } from "@/features/onboarding/components/AuthParts";
import { PrimaryButton } from "@/features/onboarding/components/PrimaryButton";
import { ERROR_COLOR, TextField } from "@/features/onboarding/components/TextField";
import { useAuth } from "@/hooks/useAuth";
import { resendVerification } from "@/services/auth";
import { colors } from "@/utils/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const { error, signIn } = useAuth();

  const show = (text: string, asError: boolean) => { setMessage(text); setIsError(asError); };

  async function submit() {
    show("", false);
    setUnconfirmed(false);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Authentication failed. Please try again.";
      show(text, true);
      // Supabase reports "Email not confirmed" for accounts that haven't verified yet.
      setUnconfirmed(/not confirmed/i.test(text));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    try {
      await resendVerification(email);
      setUnconfirmed(false);
      show("If verification is needed, check your email for a fresh link and open it on this device.", false);
    } catch (cause) {
      show(cause instanceof Error ? cause.message : "Unable to resend verification.", true);
    } finally {
      setBusy(false);
    }
  }

  const shown = message || error;
  const shownIsError = message ? isError : !!error;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackButton />
          <View style={styles.logo}><AppLogo size={80} /></View>
          <Text style={[authStyles.title, styles.title]} accessibilityRole="header">Welcome back</Text>
          <Text style={authStyles.subtitle}>Log in to see today’s energy forecast.</Text>

          <View style={styles.form}>
            <TextField label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail}
              autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email"
              textContentType="emailAddress" editable={!busy} />
            <PasswordField
              placeholder="Your password"
              value={password}
              onChangeText={setPassword}
              autoComplete="current-password"
              textContentType="password"
              editable={!busy}
              onSubmitEditing={() => { if (email.trim() && password && !busy) void submit(); }}
              labelAccessory={
                <Text style={authStyles.link} accessibilityRole="link" disabled={busy}
                  onPress={() => router.push("/auth/forgot-password")}>
                  Forgot password?
                </Text>
              }
            />

            {shown ? (
              <Text style={[authStyles.message, shownIsError && styles.error]} accessibilityRole="alert">
                {shown}
              </Text>
            ) : null}
            {unconfirmed ? (
              <Text style={authStyles.link} accessibilityRole="link" disabled={busy} onPress={resend}>
                Resend verification email
              </Text>
            ) : null}

            <PrimaryButton title="Log in" loading={busy} disabled={!email.trim() || !password} onPress={submit} />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Text style={authStyles.footerText}>
            New to EnergySync?{" "}
            <Text style={authStyles.link} accessibilityRole="link"
              onPress={() => router.push("/(auth)/onboarding/frequency")}>
              Get started
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
  logo: { marginTop: 20 },
  title: { marginTop: 24, marginBottom: 8 },
  form: { marginTop: 32, gap: 20 },
  error: { color: ERROR_COLOR },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8 },
});
