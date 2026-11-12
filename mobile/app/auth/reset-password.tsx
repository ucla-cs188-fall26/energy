import { useState } from "react";
import { Redirect } from "expo-router";
import { Button, Text, TextInput, View } from "react-native";
import { useEmailAuth } from "@/hooks/useEmailAuth";
import { useAuth } from "@/hooks/useAuth";
import { AUTHENTICATED_DESTINATION } from "@/services/auth-links";

export default function ResetPassword() {
  const { session, loading, signOut } = useAuth();
  const { ready, processing, recovery, finishRecovery } = useEmailAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (loading || !ready || processing) return null;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (!recovery) return <Redirect href={AUTHENTICATED_DESTINATION} />;
  async function save() {
    if (password !== confirmation) { setError("Passwords do not match."); return; }
    setBusy(true);
    try { await finishRecovery(password); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update password."); }
    finally { setBusy(false); }
  }
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 20 }}>
      <Text style={{ fontSize: 26 }}>Choose a new password</Text>
      <TextInput accessibilityLabel="New password" placeholder="New password" secureTextEntry
        autoCapitalize="none" autoCorrect={false} autoComplete="new-password" value={password}
        onChangeText={setPassword} editable={!busy} style={{ borderWidth: 1, padding: 14, borderRadius: 12 }} />
      <TextInput accessibilityLabel="Confirm password" placeholder="Confirm password" secureTextEntry
        autoCapitalize="none" autoCorrect={false} value={confirmation}
        onChangeText={setConfirmation} editable={!busy} style={{ borderWidth: 1, padding: 14, borderRadius: 12 }} />
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Button title={busy ? "Saving…" : "Save password"} disabled={busy || password.length < 6 || !confirmation} onPress={save} />
      <Button title="Cancel and sign out" disabled={busy} onPress={async () => {
        setBusy(true);
        try { await signOut(); }
        catch { setError("Unable to sign out. Please try again."); }
        finally { setBusy(false); }
      }} />
    </View>
  );
}
