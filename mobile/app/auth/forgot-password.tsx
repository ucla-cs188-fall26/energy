import { useState } from "react";
import { router } from "expo-router";
import { Button, Text, TextInput, View } from "react-native";
import { requestPasswordReset } from "@/services/auth";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit() {
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setMessage("If an account exists for this email, you’ll receive a reset link. Open it on this device.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to send the reset email."); }
    finally { setBusy(false); }
  }
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 20 }}>
      <Text style={{ fontSize: 26 }}>Reset your password</Text>
      <TextInput accessibilityLabel="Email" placeholder="Email" value={email} onChangeText={setEmail}
        autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email"
        editable={!busy} style={{ borderWidth: 1, padding: 14, borderRadius: 12 }} />
      {message ? <Text accessibilityRole="alert">{message}</Text> : null}
      <Button title={busy ? "Sending…" : "Send reset email"} disabled={busy || !email.trim()} onPress={submit} />
      <Button title="Back to sign in" disabled={busy} onPress={() => router.replace("/(auth)/login")} />
    </View>
  );
}
