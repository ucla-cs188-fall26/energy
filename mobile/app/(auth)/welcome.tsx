import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ComponentProps } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppLogo } from "@/features/onboarding/components/AppLogo";
import { PrimaryButton } from "@/features/onboarding/components/PrimaryButton";
import { colors } from "@/utils/theme";

type Feature = { icon: ComponentProps<typeof Ionicons>["name"]; title: string; body: string };

const FEATURES: Feature[] = [
  { icon: "moon-outline", title: "Track your sleep", body: "Cycles, duration and quality" },
  { icon: "cafe-outline", title: "Log caffeine in seconds", body: "See how much is still in your system" },
  { icon: "flash-outline", title: "Get ahead of energy dips", body: "Timely nudges to nap, move or wind down" },
];

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <AppLogo />
          <Text style={styles.title} accessibilityRole="header">
            Welcome to{"\n"}<Text style={styles.brand}>EnergySync</Text>
          </Text>
          <Text style={styles.subtitle}>Know when your energy will dip, and what to do about it.</Text>
        </View>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.card}>
              <View style={styles.iconTile}>
                <Ionicons name={f.icon} size={22} color={colors.primary} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>{f.title}</Text>
                <Text style={styles.cardBody}>{f.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title="Get started" onPress={() => router.push("/(auth)/onboarding/frequency")} />
        <Text style={styles.footerText}>
          Already have an account?{" "}
          <Text style={styles.link} accessibilityRole="link" onPress={() => router.push("/(auth)/login")}>
            Log in
          </Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, gap: 36 },
  hero: { alignItems: "center", gap: 16 },
  title: {
    marginTop: 8,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  brand: { color: colors.primary },
  subtitle: { fontSize: 17, lineHeight: 24, color: colors.textMuted, textAlign: "center", maxWidth: 300 },
  features: { gap: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.background,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  cardBody: { fontSize: 15, color: colors.textMuted },
  footer: { paddingHorizontal: 24, paddingBottom: 8, paddingTop: 12, gap: 16 },
  footerText: { textAlign: "center", fontSize: 16, color: colors.textMuted },
  link: { color: colors.primary, fontWeight: "700" },
});
