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

const AMBER = "#D97706";
const AMBER_TRACK = "#FDF1DC";

export function EnergyRing({ percent, size = 168, strokeWidth = 18 }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);
  const good = clamped >= 70;
  const color = good ? colors.energyGood : AMBER;
  const track = good ? colors.energyTrack : AMBER_TRACK;

  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`Energy ${Math.round(clamped)} percent`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={strokeWidth} fill={track} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r - strokeWidth / 2}
          fill={colors.surface}
          opacity={0.5}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
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
        <Ionicons name={good ? "happy-outline" : "remove-circle-outline"} size={30} color={color} />
        <Text style={styles.percent}>{Math.round(clamped)}%</Text>
        <Text style={[styles.label, { color }]}>Energy</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  percent: { fontSize: 34, fontWeight: "800", color: colors.text },
  label: { fontSize: 15, fontWeight: "700" },
});
