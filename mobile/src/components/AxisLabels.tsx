import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/utils/theme";

const LABEL_WIDTH = 64;

type Tick = { x: number; label: string };

/** Keeps the first and last tick, and middle ticks that fit on the chart without overlapping. */
function fitTicks(width: number, ticks: Tick[]) {
  if (ticks.length <= 2) return ticks;
  const first = ticks[0];
  const last = ticks[ticks.length - 1];
  const kept = [first];
  for (const t of ticks.slice(1, -1)) {
    const prev = kept[kept.length - 1];
    if (t.x - prev.x >= LABEL_WIDTH && last.x - t.x >= LABEL_WIDTH && t.label !== prev.label && t.label !== last.label) {
      kept.push(t);
    }
  }
  return [...kept, last];
}

/** Time labels under a chart; the first hugs the left edge and the last the right. */
export function AxisLabels({ width, ticks }: { width: number; ticks: Tick[] }) {
  const shown = fitTicks(width, ticks);
  return (
    <View style={[styles.row, { width }]}>
      {shown.map((tick, i) => {
        const first = i === 0;
        const last = i === shown.length - 1;
        const left = first ? 0 : last ? width - LABEL_WIDTH : tick.x - LABEL_WIDTH / 2;
        return (
          <Text
            key={`${tick.label}-${i}`}
            style={[styles.label, { left }, first && styles.left, last && styles.right]}
          >
            {tick.label}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 22, marginTop: 8 },
  label: { position: "absolute", width: LABEL_WIDTH, textAlign: "center", fontSize: 14, color: colors.textMuted },
  left: { textAlign: "left" },
  right: { textAlign: "right" },
});
