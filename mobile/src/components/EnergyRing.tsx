import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { colors } from "@/utils/theme";

type Props = {
  /** Energy level from 0 to 100. */
  percent: number;
  size?: number;
  strokeWidth?: number;
};

export function EnergyRing({ percent, size = 200, strokeWidth = 16 }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.energyTrack}
          strokeWidth={strokeWidth}
          fill={colors.surface}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.energyGood}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          // Start the arc at 12 o'clock instead of 3 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>
        <Ionicons name="happy-outline" size={36} color={colors.energyGood} />
        <Text style={styles.percent}>{Math.round(clamped)}%</Text>
        <Text style={styles.label}>Energy</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  percent: { fontSize: 34, fontWeight: "700", color: colors.text, marginTop: 2 },
  label: { fontSize: 14, color: colors.textMuted },
});
