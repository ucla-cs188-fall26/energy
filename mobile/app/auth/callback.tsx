import { Redirect } from "expo-router";
import { ActivityIndicator, Button, Text, View } from "react-native";
import { router } from "expo-router";

import { useAuth } from "@/hooks/useAuth";
import { useEmailAuth } from "@/hooks/useEmailAuth";
import { AUTHENTICATED_DESTINATION } from "@/services/auth-links";

export default function AuthCallback() {
  const { session, loading } = useAuth();
  const { ready, processing, success, recovery, error } = useEmailAuth();
  if (loading || !ready || processing) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!error && session && recovery) return <Redirect href="/auth/reset-password" />;
  if (success && session) return <Redirect href={recovery ? "/auth/reset-password" : AUTHENTICATED_DESTINATION} />;
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 20 }}>
      <Text accessibilityRole="alert">{error || "Open a fresh verification or password-reset email to continue."}</Text>
      <Button title={session ? "Continue to your account" : "Back to sign in"}
        onPress={() => router.replace(session ? (recovery ? "/auth/reset-password" : AUTHENTICATED_DESTINATION) : "/(auth)/login")} />
      {!session ? <Button title="Request a new reset email" onPress={() => router.replace("/auth/forgot-password")} /> : null}
    </View>
  );
}
