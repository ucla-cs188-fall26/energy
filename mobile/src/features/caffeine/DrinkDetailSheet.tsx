import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { formatTime } from "@/features/schedule";
import { colors, radius, spacing } from "@/utils/theme";

import { DrinkCategory, PRESET_IDS, servingMl } from "./catalog";
import { useCaffeineStore } from "./store";
import { CaffeineEntry } from "./types";

/** "keep" keeps an edited drink's original time; "custom" uses the time typed in by the user. */
type WhenValue = number | "keep" | "custom";
type WhenOption = { label: string; value: WhenValue };

const WHEN_OPTIONS: WhenOption[] = [
  { label: "Now", value: 0 },
  { label: "15 minutes ago", value: 15 },
  { label: "30 minutes ago", value: 30 },
  { label: "45 minutes ago", value: 45 },
  { label: "1 hour ago", value: 60 },
  { label: "1.5 hours ago", value: 90 },
  { label: "2 hours ago", value: 120 },
  { label: "3 hours ago", value: 180 },
  { label: "Other time…", value: "custom" },
];

const MINUTE = 60_000;
type Meridiem = "AM" | "PM";

/**
 * Parses a typed clock time ("8", "8:30", "830", "8:30pm") as a time today. An am/pm suffix
 * overrides `meridiem`. Returns null when the text isn't a valid 12-hour time; see `isFutureTime`.
 */
export function parseTypedTime(text: string, meridiem: Meridiem, now = Date.now()): number | null {
  const m = text.trim().toLowerCase().match(/^(\d{1,2})(?::?(\d{2}))?\s*(am?|pm?)?$/);
  if (!m) return null;
  const hour12 = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  if (hour12 < 1 || hour12 > 12 || minute > 59) return null;
  const pm = m[3] ? m[3].startsWith("p") : meridiem === "PM";
  const at = new Date(now);
  at.setHours((hour12 % 12) + (pm ? 12 : 0), minute, 0, 0);
  return at.getTime();
}

/** Typed times can't be later than now; a drink can't start in the future. */
export const isFutureTime = (ms: number, now = Date.now()) => ms > now;

/** "Today, 8:15 AM", or "Yesterday, 11:40 PM" for an edited drink from yesterday. */
function formatPickedTime(ms: number) {
  const sameDay = new Date(ms).toDateString() === new Date().toDateString();
  return `${sameDay ? "Today" : "Yesterday"}, ${formatTime(ms)}`;
}

/** Text and AM/PM for a timestamp, to prefill the manual time field. */
function toTypedTime(ms: number): { text: string; meridiem: Meridiem } {
  const d = new Date(ms);
  const h = d.getHours();
  return { text: `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")}`, meridiem: h < 12 ? "AM" : "PM" };
}

const MAX_MG = 1500;
const ML_PER_FL_OZ = 29.5735;
/** The API requires a serving volume; used when the user leaves it blank and the drink has no known size. */
const DEFAULT_SERVING_ML = 8 * ML_PER_FL_OZ;

const mlToOz = (ml: string) => (ml ? String(Math.round((Number(ml) / ML_PER_FL_OZ) * 10) / 10) : "");

type Props = {
  /** Category to show; null hides the sheet. */
  category: DrinkCategory | null;
  onClose: () => void;
  onLogged: () => void;
  /** iOS: fires after the sheet has finished animating away. */
  onDismiss?: () => void;
  /** When set, the sheet edits this logged drink instead of logging a new one. */
  entry?: CaffeineEntry | null;
};

export function DrinkDetailSheet({ category, onClose, onLogged, onDismiss, entry }: Props) {
  // Keep the last category and drink rendered while the sheet animates closed.
  const [shown, setShown] = useState(category);
  const [shownEntry, setShownEntry] = useState(entry ?? null);
  useEffect(() => {
    if (category) {
      setShown(category);
      setShownEntry(entry ?? null);
    }
  }, [category, entry]);

  return (
    <Modal
      visible={category !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      {shown && (
        <SheetContent
          key={`${shown.id}-${shownEntry?.id ?? "new"}`}
          category={shown}
          entry={shownEntry}
          onClose={onClose}
          onLogged={onLogged}
        />
      )}
    </Modal>
  );
}

function SheetContent({ category, entry, onClose, onLogged }: { category: DrinkCategory } & Omit<Props, "category">) {
  const addEntry = useCaffeineStore((s) => s.addEntry);
  const updateEntry = useCaffeineStore((s) => s.updateEntry);
  const editing = !!entry;
  const presets = useCaffeineStore(s => s.presets);
  const [saving, setSaving] = useState(false);
  const options = category.options.map(o => {
    const preset = presets.find(p => p.id === PRESET_IDS[o.id]);
    return preset ? { ...o, mg: Number(preset.caffeine_mg), ml: String(preset.serving_size_ml) } : { ...o, ml: servingMl(o) };
  });
  const isCustom = category.options.length === 0;
  // Editing: preselect the catalog option whose name matches the logged drink.
  const initial = entry ? options.find((o) => `${o.label} (${o.size})` === entry.name) : options[0];
  const [ozText, setOzText] = useState(
    entry ? (entry.servingSizeMl ? mlToOz(String(entry.servingSizeMl)) : "") : mlToOz(options[0]?.ml ?? ""));

  const [optionId, setOptionId] = useState(initial?.id);
  const [mgText, setMgText] = useState(entry ? String(entry.mg) : options[0] ? String(options[0].mg) : "");
  const [customName, setCustomName] = useState(entry && isCustom ? entry.name : "");
  const whenOptions: WhenOption[] = entry
    ? [{ label: `Keep ${formatTime(Date.parse(entry.consumedAt))}`, value: "keep" }, ...WHEN_OPTIONS]
    : WHEN_OPTIONS;
  // New drinks default to "Now".
  const [when, setWhen] = useState<WhenValue>(entry ? "keep" : 0);
  const [whenOpen, setWhenOpen] = useState(false);
  // Typed time for "Other time…": prefilled with the edited drink's time; blank for a new drink.
  const initialTyped = entry ? toTypedTime(Date.parse(entry.consumedAt)) : null;
  const [timeText, setTimeText] = useState(initialTyped?.text ?? "");
  const [meridiem, setMeridiem] = useState<Meridiem>(initialTyped?.meridiem ?? (new Date().getHours() < 12 ? "AM" : "PM"));
  const customAt = parseTypedTime(timeText, meridiem);
  const customFuture = customAt !== null && isFutureTime(customAt);
  const timeValid = when !== "custom" || (customAt !== null && !customFuture);

  const option = options.find((o) => o.id === optionId);
  const mg = Number(mgText);
  const oz = Number(ozText);
  // Serving volume is optional; when entered it must be a positive number of fluid ounces.
  const ozValid = ozText.trim() === "" || (Number.isFinite(oz) && oz > 0 && oz < 1_000_000);
  const mgValid = mgText.trim() !== "" && Number.isFinite(mg) && mg >= 0 && mg <= MAX_MG && ozValid && (!isCustom || customName.trim().length <= 150);
  const valid = mgValid && timeValid;
  // Blank serving falls back to the drink's catalog size so the API still gets a volume.
  const servingSizeMl = ozText.trim() !== ""
    ? oz * ML_PER_FL_OZ
    : Number(option?.ml) > 0 ? Number(option!.ml) : DEFAULT_SERVING_ML;
  const whenLabel = when === "custom"
    ? "Other time…"
    : whenOptions.find((o) => o.value === when)?.label ?? "Now";
  const consumedAt = when === "keep" && entry
    ? entry.consumedAt
    : when === "custom"
      ? new Date(customAt ?? Date.now()).toISOString()
      : new Date(Date.now() - (typeof when === "number" ? when : 0) * MINUTE).toISOString();

  const log = async () => {
    if (!valid || saving) return;
    setSaving(true);
    try {
    const name = isCustom ? customName.trim() || "Custom drink" : option ? `${option.label} (${option.size})` : category.name;
    if (entry) {
      await updateEntry({
        ...entry,
        name,
        mg: Math.round(mg * 100) / 100,
        servingSizeMl: Number(servingSizeMl.toFixed(2)),
        consumedAt,
      });
      onLogged();
      return;
    }
    await addEntry({
      name,
      mg: Math.round(mg * 100) / 100,
      servingSizeMl: Number(servingSizeMl.toFixed(2)),
      presetId: presets.some(p => p.id === PRESET_IDS[optionId ?? ""]) ? PRESET_IDS[optionId ?? ""] : undefined,
      consumedAt,
      durationMinutes: 0,
      categoryId: category.id,
      optionId: isCustom ? undefined : optionId,
    });
    onLogged();
    } catch (e) { Alert.alert(editing ? "Unable to save drink" : "Unable to log drink", e instanceof Error ? e.message : "Please try again."); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>{editing ? `Edit ${category.name === "Other" ? "drink" : category.name}` : category.name}</Text>
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
                      setOzText(mlToOz(o.ml));
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

        <Text style={styles.sectionTitle}>
          Serving volume (fl oz) <Text style={styles.optional}>· optional</Text>
        </Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={ozText}
          onChangeText={setOzText}
          placeholder="e.g. 8"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Serving volume in fluid ounces, optional"
        />

        <Text style={styles.sectionTitle}>When did you start drinking?</Text>
        <View style={styles.dropdown}>
          <Pressable
            onPress={() => setWhenOpen((v) => !v)}
            style={styles.dropdownButton}
            accessibilityRole="button"
            accessibilityLabel={`When did you start drinking? ${whenLabel}`}
            accessibilityState={{ expanded: whenOpen }}
          >
            <Text style={styles.dropdownText}>{whenLabel}</Text>
            <Ionicons name={whenOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
          </Pressable>
          {whenOpen &&
            whenOptions.map((o) => {
              const selected = o.value === when;
              return (
                <Pressable
                  key={o.label}
                  onPress={() => {
                    setWhen(o.value);
                    setWhenOpen(false);
                  }}
                  style={[styles.dropdownItem, selected && styles.optionSelected]}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.dropdownText, selected && { fontWeight: "700" }]}>{o.label}</Text>
                  {selected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </Pressable>
              );
            })}
        </View>

        {when === "custom" && (
          <>
            <View style={styles.timeEntryRow}>
              <TextInput
                style={[styles.input, styles.timeInput]}
                placeholder="e.g. 8:30"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
                value={timeText}
                onChangeText={setTimeText}
                maxLength={8}
                autoFocus={!editing}
                accessibilityLabel="Time you started drinking"
              />
              <View style={styles.meridiem}>
                {(["AM", "PM"] as const).map((m) => {
                  const selected = m === meridiem;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setMeridiem(m)}
                      style={[styles.meridiemButton, selected && styles.meridiemSelected]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.meridiemText, selected && styles.meridiemTextSelected]}>{m}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Text style={styles.hint} accessibilityLiveRegion="polite">
              {customFuture
                ? `That's later than now (${formatTime(Date.now())}). Enter an earlier time.`
                : customAt !== null
                  ? formatPickedTime(customAt)
                  : timeText.trim()
                    ? "Enter a time like 8:30"
                    : `Enter a time earlier today, up to ${formatTime(Date.now())}.`}
            </Text>
          </>
        )}

      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={log} disabled={!valid || saving} style={[styles.logButton, !valid && styles.logButtonDisabled]}>
          <Text style={styles.logButtonText}>{saving ? "Saving…" : !mgValid ? "Enter caffeine amount" : !timeValid ? "Enter a valid time" : editing ? "Save changes" : `Log ${mg} mg`}</Text>
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
  optional: { fontSize: 13, fontWeight: "400", color: colors.textMuted },
  dropdown: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  dropdownButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dropdownText: { fontSize: 16, color: colors.text },
  timeEntryRow: { flexDirection: "row", gap: spacing.sm, alignItems: "stretch" },
  timeInput: { flex: 1 },
  meridiem: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  meridiemButton: { justifyContent: "center", paddingHorizontal: spacing.md },
  meridiemSelected: { backgroundColor: colors.primary },
  meridiemText: { fontSize: 15, fontWeight: "700", color: colors.textMuted },
  meridiemTextSelected: { color: "#fff" },
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
