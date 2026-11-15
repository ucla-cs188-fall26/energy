import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { BackButton } from "@/features/onboarding/components/AuthParts";
import { useProfileSettings } from "@/features/profile/store";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentUser } from "@/services/api";
import { colors } from "@/utils/theme";

const DANGER = "#B42318";

export default function AccountScreen() {
  const { session, signOut } = useAuth();
  const { name } = useProfileSettings();
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
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton fallback="/(tabs)" />
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(name ?? session?.user.email ?? "?").charAt(0).toUpperCase()}</Text>
          </View>
          {name ? <Text style={styles.name}>{name}</Text> : null}
          <Text style={styles.email}>{session?.user.email}</Text>
        </View>

        <Card style={styles.list}>
          <Row label="Edit profile" disabled={busy} onPress={() => router.push("/edit-profile")} />
          <Row label="Verify backend connection" divider disabled={busy} onPress={() => perform(async () => {
            const user = await getCurrentUser();
            return `Connected as ${user.email}`;
          })} />
          <Row label="Log out" color={DANGER} disabled={busy} divider onPress={() => perform(async () => {
            await signOut();
            return "";
          })} />
        </Card>
        {message ? <Text style={styles.message} accessibilityRole="alert">{message}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, onPress, disabled, color = colors.text, divider }: {
  label: string; onPress: () => void; disabled?: boolean; color?: string; divider?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, divider && styles.divider, (pressed || disabled) && styles.dim]}
    >
      <Text style={[styles.rowText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, gap: 20 },
  profile: { alignItems: "center", gap: 6, marginTop: 8 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarText: { fontSize: 34, fontWeight: "800", color: colors.primary },
  name: { fontSize: 24, fontWeight: "800", color: colors.text },
  email: { fontSize: 16, color: colors.textMuted },
  list: { paddingVertical: 4 },
  row: { paddingVertical: 16 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  dim: { opacity: 0.5 },
  rowText: { fontSize: 17, fontWeight: "700" },
  message: { fontSize: 15, color: colors.textMuted, textAlign: "center" },
});
