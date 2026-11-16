import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Chip } from "@/components/Chip";
import { colors, radius, spacing } from "@/utils/theme";

import { DrinkCategory, PRESET_IDS, servingMl } from "./catalog";
import { useCaffeineStore } from "./store";

const WHEN_OPTIONS = [
  { label: "Now", minutesAgo: 0 },
  { label: "15m ago", minutesAgo: 15 },
  { label: "30m ago", minutesAgo: 30 },
  { label: "1h ago", minutesAgo: 60 },
  { label: "2h ago", minutesAgo: 120 },
  { label: "3h ago", minutesAgo: 180 },
];

const MAX_MG = 1500;

type Props = {
  /** Category to show; null hides the sheet. */
  category: DrinkCategory | null;
  onClose: () => void;
  onLogged: () => void;
  /** iOS: fires after the sheet has finished animating away. */
  onDismiss?: () => void;
};

export function DrinkDetailSheet({ category, onClose, onLogged, onDismiss }: Props) {
  // Keep the last category rendered while the sheet animates closed.
  const [shown, setShown] = useState(category);
  useEffect(() => {
    if (category) setShown(category);
  }, [category]);

  return (
    <Modal
      visible={category !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      {shown && <SheetContent key={shown.id} category={shown} onClose={onClose} onLogged={onLogged} />}
    </Modal>
  );
}

function SheetContent({ category, onClose, onLogged }: { category: DrinkCategory } & Omit<Props, "category">) {
  const addEntry = useCaffeineStore((s) => s.addEntry);
  const presets = useCaffeineStore(s => s.presets);
  const [saving, setSaving] = useState(false);
  const options = category.options.map(o => {
    const preset = presets.find(p => p.id === PRESET_IDS[o.id]);
    return preset ? { ...o, mg: Number(preset.caffeine_mg), ml: String(preset.serving_size_ml) } : { ...o, ml: servingMl(o) };
  });
  const [mlText, setMlText] = useState(options[0]?.ml ?? "");
  const isCustom = category.options.length === 0;

  const [optionId, setOptionId] = useState(category.options[0]?.id);
  const [mgText, setMgText] = useState(options[0] ? String(options[0].mg) : "");
  const [customName, setCustomName] = useState("");
  const [minutesAgo, setMinutesAgo] = useState(0);


  const option = options.find((o) => o.id === optionId);
  const mg = Number(mgText);
  const valid = mgText.trim() !== "" && Number.isFinite(mg) && mg >= 0 && mg <= MAX_MG && Number(mlText) > 0 && Number(mlText) < 100000000 && (!isCustom || customName.trim().length <= 150);

  const log = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
    const name = isCustom ? customName.trim() || "Custom drink" : option ? `${option.label} (${option.size})` : category.name;
    await addEntry({
      name,
      mg: Math.round(mg * 100) / 100,
      servingSizeMl: Number(Number(mlText).toFixed(2)),
      presetId: presets.some(p => p.id === PRESET_IDS[optionId ?? ""]) ? PRESET_IDS[optionId ?? ""] : undefined,
      consumedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
      durationMinutes: 0,
      categoryId: category.id,
      optionId: isCustom ? undefined : optionId,
    });
    onLogged();
    } catch (e) { Alert.alert("Unable to log drink", e instanceof Error ? e.message : "Please try again."); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{category.name}</Text>
        <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {isCustom ? (
          <>
            <Text style={styles.sectionTitle}>Drink name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Yerba mate"
              placeholderTextColor={colors.textMuted}
              value={customName}
              onChangeText={setCustomName}
            />
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Brand & size</Text>
            <View style={styles.card}>
              {options.map((o, i) => {
                const selected = o.id === optionId;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => {
                      setOptionId(o.id);
                      setMgText(String(o.mg));
                      setMlText(o.ml);
                    }}
                    style={[styles.optionRow, i > 0 && styles.divider, selected && styles.optionSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={20}
                      color={selected ? colors.primary : colors.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.optionLabel}>{o.label}</Text>
                      <Text style={styles.muted}>{o.size}</Text>
                    </View>
                    <Text style={styles.optionMg}>{o.mg} mg</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Caffeine (mg)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 150"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          value={mgText}
          onChangeText={setMgText}
        />
        <Text style={styles.hint}>Amounts are approximate. Check the label and edit if needed.</Text>

        <Text style={styles.sectionTitle}>Serving volume (ml)</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={mlText} onChangeText={setMlText} placeholder="e.g. 237" />
        <Text style={styles.sectionTitle}>When did you start drinking it?</Text>
        <View style={styles.chips}>
          {WHEN_OPTIONS.map((o) => (
            <Chip
              key={o.label}
              label={o.label}
              selected={o.minutesAgo === minutesAgo}
              onPress={() => setMinutesAgo(o.minutesAgo)}
            />
          ))}
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={log} disabled={!valid || saving} style={[styles.logButton, !valid && styles.logButtonDisabled]}>
          <Text style={styles.logButtonText}>{saving ? "Saving…" : valid ? `Log ${mg} mg` : "Enter caffeine and serving volume"}</Text>
        </Pressable>
      </View>
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
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  optionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  optionSelected: { backgroundColor: colors.primarySoft },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  optionLabel: { fontSize: 15, fontWeight: "600", color: colors.text },
  optionMg: { fontSize: 15, fontWeight: "700", color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  hint: { fontSize: 12, color: colors.textMuted },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  logButton: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 16, alignItems: "center" },
  logButtonDisabled: { opacity: 0.4 },
  logButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
