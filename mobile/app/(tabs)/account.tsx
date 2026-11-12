import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/hooks/useAuth";
import { getCurrentUser } from "@/services/api";
import { colors } from "@/utils/theme";

export default function AccountScreen() {
  const { session, signOut } = useAuth();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function perform(action: () => Promise<string>) {
    setBusy(true);
    setMessage("");
    try { setMessage(await action()); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Please try again"); }
    finally { setBusy(false); }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account</Text>
      <Text>{session?.user.email}</Text>
      <Button title="Verify backend connection" disabled={busy} onPress={() => perform(async () => {
        const user = await getCurrentUser();
        return `Authenticated as ${user.email} (${user.id})`;
      })} />
      {message ? <Text accessibilityRole="alert">{message}</Text> : null}
      <Button title="Log out" disabled={busy} onPress={() => perform(async () => {
        await signOut();
        return "";
      })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 72, gap: 20, backgroundColor: colors.background },
  title: { fontSize: 28, fontWeight: "700", color: colors.text },
});
