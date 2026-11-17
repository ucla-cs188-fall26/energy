import { Pressable, StyleSheet, Text } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

/** Night palette shared by the Sleeping, Napping and rating screens. */
export const night = {
  bg: "#15132B",
  panel: "#221F3D",
  moon: "#CFC3F7",
  text: "#EFEBFD",
  muted: "#A9A3CC",
  bar: "#8B76F0",
  barTrack: "#3A355E",
};

export function MoonArt({ size = 140 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx={46} cy={54} r={32} fill={night.moon} />
      <Circle cx={62} cy={40} r={28} fill={night.bg} />
      <Path d="M74 14 L76 20 L82 22 L76 24 L74 30 L72 24 L66 22 L72 20 Z" fill={night.moon} />
      <Circle cx={86} cy={34} r={2.2} fill={night.moon} />
    </Svg>
  );
}

/** Large light button used at the bottom of the night screens. */
export function NightButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { height: 60, borderRadius: 18, backgroundColor: night.text, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
  text: { fontSize: 19, fontWeight: "800", color: night.bg },
});
