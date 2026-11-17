import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { colors } from "@/utils/theme";

type Props = {
  /** Energy level from 0 to 100. */
  percent: number | null;
  size?: number;
  strokeWidth?: number;
};

const AMBER = "#D97706";
const AMBER_TRACK = "#FDF1DC";

export function EnergyRing({ percent, size = 168, strokeWidth = 18 }: Props) {
  const clamped = Math.max(0, Math.min(100, percent ?? 0));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);
  const good = percent === null || clamped >= 70;
  const color = good ? colors.energyGood : AMBER;
  const track = good ? colors.energyTrack : AMBER_TRACK;

  return (
    <View style={{ width: size, height: size }} accessibilityLabel={percent === null ? "Energy unavailable" : `Estimated energy ${Math.round(clamped)} percent`}>
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
        <EnergyFace mood={percent === null ? "neutral" : clamped >= 70 ? "happy" : "tired"}
          color={percent === null ? colors.textMuted : color} />
        <Text style={styles.percent}>{percent === null ? "—" : `${Math.round(clamped)}%`}</Text>
        <Text style={[styles.label, { color }]}>Energy</Text>
      </View>
    </View>
  );
}

type Mood = "happy" | "tired" | "neutral";

/** Outline face: happy at 70%+, tired below, neutral when energy is unavailable. */
function EnergyFace({ mood, color, size = 32 }: { mood: Mood; color: string; size?: number }) {
  const stroke = { stroke: color, strokeWidth: 2.2, strokeLinecap: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityLabel={`${mood} face`}>
      <Circle cx={16} cy={16} r={13.5} {...stroke} />
      {mood === "happy" ? (
        <>
          <Circle cx={11.5} cy={13} r={1.7} fill={color} />
          <Circle cx={20.5} cy={13} r={1.7} fill={color} />
          <Path d="M10.5 19 Q16 24.5 21.5 19" {...stroke} />
        </>
      ) : mood === "tired" ? (
        <>
          {/* Heavy, half-closed eyes drooping toward the outside. */}
          <Path d="M8.5 13.5 Q11.5 16 14 13.8" {...stroke} />
          <Path d="M18 13.8 Q20.5 16 23.5 13.5" {...stroke} />
          {/* Flat mouth. */}
          <Path d="M11.5 21.5 H20.5" {...stroke} />
        </>
      ) : (
        <>
          <Circle cx={11.5} cy={13} r={1.7} fill={color} />
          <Circle cx={20.5} cy={13} r={1.7} fill={color} />
          <Path d="M11 20.5 H21" {...stroke} />
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  center: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  percent: { fontSize: 34, fontWeight: "800", color: colors.text },
  label: { fontSize: 15, fontWeight: "700" },
});
