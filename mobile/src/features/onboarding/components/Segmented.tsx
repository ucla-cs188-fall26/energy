import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/utils/theme";

type Props<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  /** "solid": purple selected pill. "light": white selected pill with dark text. */
  variant?: "solid" | "light";
};

/** Pill-shaped segmented control, e.g. Low / Medium / High. */
export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel, variant = "solid" }: Props<T>) {
  const light = variant === "light";
  return (
    <View style={styles.track} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, selected && (light ? styles.selectedLight : styles.selected)]}
          >
            <Text style={[styles.label, light && styles.labelLight, selected && (light ? styles.labelSelectedLight : styles.labelSelected)]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", padding: 6, borderRadius: 18, backgroundColor: colors.primarySoft },
  segment: { flex: 1, paddingVertical: 14, borderRadius: 13, alignItems: "center" },
  selected: { backgroundColor: colors.primary },
  label: { fontSize: 17, fontWeight: "700", color: colors.primary },
  labelSelected: { color: colors.surface },
  selectedLight: {
    backgroundColor: colors.surface,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  labelLight: { color: colors.textMuted },
  labelSelectedLight: { color: colors.text },
});
