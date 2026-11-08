import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DRINK_CATEGORIES, DrinkCategory } from "@/features/caffeine/catalog";
import { DrinkDetailSheet } from "@/features/caffeine/DrinkDetailSheet";
import { colors, radius, spacing } from "@/utils/theme";

export default function LogDrinkScreen() {
  const [category, setCategory] = useState<DrinkCategory | null>(null);
  // After logging, wait for the detail sheet to finish closing before closing this screen,
  // so iOS doesn't try to dismiss two sheets at once.
  const closeAfterSheet = useRef(false);

  const handleLogged = () => {
    closeAfterSheet.current = true;
    setCategory(null);
    if (Platform.OS !== "ios") router.back(); // onDismiss is iOS-only
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Log a Drink</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>What did you drink?</Text>
        <View style={styles.grid}>
          {DRINK_CATEGORIES.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setCategory(c)}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              accessibilityRole="button"
            >
              <Ionicons name={c.icon} size={26} color={colors.primary} />
              <Text style={styles.tileLabel} numberOfLines={2}>
                {c.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <DrinkDetailSheet
        category={category}
        onClose={() => setCategory(null)}
        onLogged={handleLogged}
        onDismiss={() => {
          if (closeAfterSheet.current) router.back();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: 20, fontWeight: "700", color: colors.text },
  scroll: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    width: "31.5%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  tilePressed: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  tileLabel: { fontSize: 13, fontWeight: "600", color: colors.text, textAlign: "center" },
});
