import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DRINK_CATEGORIES, DrinkCategory } from "@/features/caffeine/catalog";
import { DrinkDetailSheet } from "@/features/caffeine/DrinkDetailSheet";
import { colors } from "@/utils/theme";

const COLUMNS = 3;

export default function LogDrinkScreen() {
  const [category, setCategory] = useState<DrinkCategory | null>(null);
  // After logging, wait for the detail sheet to finish closing before closing this screen,
  // so iOS doesn't try to dismiss two sheets at once.
  const closeAfterSheet = useRef(false);
  // Rows of three; each row stretches so the grid fills the screen.
  const rows = Array.from({ length: Math.ceil(DRINK_CATEGORIES.length / COLUMNS) },
    (_, i) => DRINK_CATEGORIES.slice(i * COLUMNS, (i + 1) * COLUMNS));

  const handleLogged = () => {
    closeAfterSheet.current = true;
    setCategory(null);
    if (Platform.OS !== "ios") router.back(); // onDismiss is iOS-only
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">Log a drink</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>What did you drink?</Text>
        <View style={styles.grid}>
          {rows.map((row, i) => (
            <View key={i} style={styles.row}>
              {row.map((c) => {
                // "Other" (custom drink) is filled purple so it stands out from the presets.
                const other = c.id === "other";
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setCategory(c)}
                    style={({ pressed }) => [
                      styles.tile,
                      other && styles.otherTile,
                      pressed && (other ? styles.otherTilePressed : styles.tilePressed),
                    ]}
                    accessibilityRole="button"
                  >
                    <View style={[styles.iconTile, other && styles.otherIconTile]}>
                      <Ionicons name={c.icon} size={30} color={other ? "#fff" : colors.primary} />
                    </View>
                    <Text style={[styles.tileLabel, other && styles.otherTileLabel]} numberOfLines={2}>
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
              {/* Keep tiles in a short last row the same width as the others. */}
              {Array.from({ length: COLUMNS - row.length }, (_, j) => <View key={`pad-${j}`} style={styles.pad} />)}
            </View>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.text },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 14 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  grid: { flex: 1, gap: 12 },
  row: { flex: 1, flexDirection: "row", gap: 12 },
  tile: {
    flex: 1,
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 10,
  },
  tilePressed: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  iconTile: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: { fontSize: 16, fontWeight: "700", color: colors.text, textAlign: "center" },
  otherTile: { backgroundColor: colors.primary, borderColor: colors.primary },
  otherTilePressed: { opacity: 0.85 },
  otherIconTile: { backgroundColor: "rgba(255,255,255,0.2)" },
  otherTileLabel: { color: "#fff" },
  pad: { flex: 1 },
});
