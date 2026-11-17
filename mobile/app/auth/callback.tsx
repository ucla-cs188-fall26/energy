import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppLogo } from "@/features/onboarding/components/AppLogo";
import { authStyles } from "@/features/onboarding/components/AuthParts";
import { PrimaryButton } from "@/features/onboarding/components/PrimaryButton";
import { useAuth } from "@/hooks/useAuth";
import { useEmailAuth } from "@/hooks/useEmailAuth";
import { AUTHENTICATED_DESTINATION } from "@/services/auth-links";
import { colors } from "@/utils/theme";

const WARN = "#B45309";
const WARN_SOFT = "#FDF1E3";

/** Opened from email links (sign-up confirmation and password reset). */
export default function AuthCallback() {
  const { session, loading } = useAuth();
  const { ready, processing, success, recovery, error } = useEmailAuth();

  if (loading || !ready || processing) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <AppLogo size={88} />
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
          <Text style={authStyles.subtitle}>Confirming your email…</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!error && session && recovery) return <Redirect href="/auth/reset-password" />;
  if (success && session) return <Redirect href={recovery ? "/auth/reset-password" : AUTHENTICATED_DESTINATION} />;

  const continueTo = session ? (recovery ? "/auth/reset-password" : AUTHENTICATED_DESTINATION) : "/(auth)/login";
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <View style={styles.iconTile}>
          <Ionicons name="alert-circle-outline" size={36} color={WARN} />
        </View>
        <Text style={authStyles.title} accessibilityRole="header">
          {error ? "This link didn’t work" : "Open your email link"}
        </Text>
        <Text style={authStyles.subtitle} accessibilityRole="alert">
          {error || "Open a fresh verification or password-reset email to continue."}
        </Text>
      </View>
      <View style={styles.footer}>
        <PrimaryButton
          title={session ? "Continue to your account" : "Back to log in"}
          onPress={() => router.replace(continueTo)}
        />
        {!session ? (
          <Text style={authStyles.footerText}>
            Resetting your password?{" "}
            <Text style={authStyles.link} accessibilityRole="link" onPress={() => router.replace("/auth/forgot-password")}>
              Request a new reset email
            </Text>
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 24 },
  spinner: { marginTop: 8 },
  body: { flex: 1, justifyContent: "center", gap: 14, paddingHorizontal: 24 },
  iconTile: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: WARN_SOFT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8, gap: 16 },
});
