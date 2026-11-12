import { router, Stack } from "expo-router";
import { useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { EmailAuthProvider, useEmailAuth } from "@/hooks/useEmailAuth";
import { AUTHENTICATED_DESTINATION } from "@/services/auth-links";

export default function RootLayout() {
  return <AuthProvider><EmailAuthProvider><Navigation /></EmailAuthProvider></AuthProvider>;
}

function Navigation() {
  const { session, loading } = useAuth();
  const { ready, processing, recovery, success, error, resultId } = useEmailAuth();
  const handledResult = useRef(0);
  const waiting = loading || !ready || processing;

  useEffect(() => {
    if (waiting || resultId <= handledResult.current) return;
    if (error) {
      handledResult.current = resultId;
      router.replace("/auth/callback");
    } else if (success && session) {
      handledResult.current = resultId;
      router.replace(recovery ? "/auth/reset-password" : AUTHENTICATED_DESTINATION);
    }
  }, [waiting, success, recovery, error, session, resultId]);
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!session && recovery}>
          <Stack.Screen name="auth/reset-password" />
        </Stack.Protected>
        <Stack.Protected guard={!!session && !recovery}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="log-drink" options={{ presentation: "modal" }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)/login" />
          <Stack.Screen name="auth/forgot-password" />
        </Stack.Protected>
        <Stack.Screen name="auth/callback" />
      </Stack>
      {waiting ? (
        <View accessibilityLabel="Restoring authentication" style={{
          position: "absolute", top: 0, bottom: 0, left: 0, right: 0,
          backgroundColor: "#F7F6FB", justifyContent: "center", zIndex: 1,
        }}>
          <ActivityIndicator />
        </View>
      ) : null}
    </>
  );
}
