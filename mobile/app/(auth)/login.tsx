import { useState } from "react";
import { router } from "expo-router";
import { ActivityIndicator, Button, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/utils/theme";
import { resendVerification } from "@/services/auth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { error, signIn, signUp } = useAuth();

  async function submit() {
    setMessage("");
    setBusy(true);
    try {
      if (signup) {
        const data = await signUp(email, password);
        if (!data.session) {
          setMessage("Check your email and open the confirmation link on this device to finish signing in.");
          setSignup(false);
          setPassword("");
        }
      } else {
        await signIn(email, password);
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.form}>
        <Text style={styles.title}>{signup ? "Create an account" : "Sign in to Energy"}</Text>
        <TextInput accessibilityLabel="Email" placeholder="Email" value={email} onChangeText={setEmail}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email"
          editable={!busy} style={styles.input} />
        <TextInput accessibilityLabel="Password" placeholder="Password" value={password} onChangeText={setPassword}
          secureTextEntry autoCapitalize="none" autoCorrect={false}
          autoComplete={signup ? "new-password" : "current-password"} editable={!busy} style={styles.input} />
        {(message || error) ? <Text accessibilityRole="alert">{message || error}</Text> : null}
        {busy ? <ActivityIndicator /> : null}
        <Button title={signup ? "Sign up" : "Log in"} onPress={submit} disabled={busy || !email.trim() || !password} />
        {!signup ? <Button title="Forgot password?" disabled={busy} onPress={() => router.push("/auth/forgot-password")} /> : null}
        {!signup ? <Button title="Resend verification email" disabled={busy || !email.trim()} onPress={async () => {
          setBusy(true);
          try {
            await resendVerification(email);
            setMessage("If verification is needed, check your email for a fresh link and open it on this device.");
          } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to resend verification."); }
          finally { setBusy(false); }
        }} /> : null}
        <Button title={signup ? "Already have an account? Log in" : "Create an account"}
          disabled={busy} onPress={() => { setSignup(!signup); setMessage(""); setPassword(""); }} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: colors.background },
  form: { gap: 16, width: "100%", maxWidth: 440, alignSelf: "center" },
  title: { fontSize: 28, fontWeight: "700", color: colors.text },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 12, padding: 14 },
});
