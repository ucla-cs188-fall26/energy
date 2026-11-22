import { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from "react-native-svg";

import { AxisLabels } from "@/components/AxisLabels";
import { linePath, makeScale, useWidth } from "@/components/charts";
import { formatHour, formatTime } from "@/features/schedule";
import { colors } from "@/utils/theme";

import {
  axisTicks, ChartPoint, chartWindow, scrubTime, valueAt, yMax,
} from "./chartWindow";

const HEIGHT = 190;
const TOP = 36; // room for the Now pill above the plot
const NOW_PILL_H = 24;
const HANDLE_R = 11;

type Props = {
  /** Samples across the window; includes a sample exactly at now. */
  points: ChartPoint[];
  now: number;
  /** Next upcoming bedtime, or null when none is set. */
  bedtime: number | null;
  /** Projected mg at that bedtime (for screen readers; the tile above shows it). */
  bedMg: number;
  /** No doses in the last 24h. */
  empty: boolean;
};

/** Rough rendered width of SVG text, for sizing the pill. */
const textWidth = (s: string, fontSize: number) => s.length * fontSize * 0.56;

/**
 * One line, one number: caffeine in your system over the last and next 12 hours.
 * Solid = so far, dashed = where it's heading if you don't have more.
 * Touch and drag across the chart to read the amount at any time in the window.
 */
export function CaffeineChart({ points, now, bedtime, bedMg, empty }: Props) {
  const [width, onLayout] = useWidth();
  const { t0, t1 } = chartWindow(now);
  // mgInSystem at now: the same value as the "In system now" tile.
  const nowMg = Math.round(points.find((p) => p.t === now)?.mg ?? 0);
  const baseY = HEIGHT;
  // Time picked by dragging; null shows now. Kept as a time so it stays put as now ticks forward.
  const [scrubAt, setScrubAt] = useState<number | null>(null);
  // The pan handlers are created once, so they read the latest width and now through refs.
  const live = useRef({ width, now });
  live.current = { width, now };
  const pan = useMemo(() => {
    const move = (x: number) => setScrubAt(scrubTime(x, live.current.width, live.current.now));
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (e) => move(e.nativeEvent.locationX),
      onPanResponderMove: (e) => move(e.nativeEvent.locationX),
      // Let the screen scroll if the finger is moving mostly up or down.
      onPanResponderTerminationRequest: (_, g) => Math.abs(g.dy) > Math.abs(g.dx),
    });
  }, []);

  const geometry = useMemo(() => {
    if (width <= 0 || points.length < 2) return null;
    const scale = makeScale(width, HEIGHT, { t0, t1, v0: 0, v1: yMax(points) }, { top: TOP, bottom: 0 });
    const xy = (p: ChartPoint) => ({ x: scale.x(p.t), y: scale.y(p.mg) });
    const past = points.filter((p) => p.t <= now).map(xy);
    const future = points.filter((p) => p.t >= now).map(xy);
    const area = (pts: { x: number; y: number }[]) =>
      pts.length ? `${linePath(pts)} L${pts[pts.length - 1].x},${baseY} L${pts[0].x},${baseY} Z` : "";
    return {
      scale,
      pastLine: linePath(past),
      pastArea: area(past),
      futureLine: linePath(future),
      futureArea: area(future),
      nowPoint: past[past.length - 1] ?? future[0],
      ticks: axisTicks(now).map((t) => ({ x: scale.x(t), label: formatHour(t) })),
    };
  }, [width, points, now, t0, t1, baseY]);

  const bedInWindow = bedtime !== null && bedtime <= t1;
  const a11y = `Caffeine in your system: ${nowMg} mg now` +
    (bedtime !== null ? `, about ${bedMg} mg at ${formatHour(bedtime)} bedtime` : "");

  if (!geometry) return <View onLayout={onLayout} style={{ height: HEIGHT + 56 }} />;
  const { scale, nowPoint, ticks } = geometry;
  const nowX = scale.x(now);
  const nowText = `${nowMg} mg now`;
  const nowPillW = textWidth(nowText, 13) + 20;
  const pillX = Math.min(width - nowPillW, Math.max(0, nowX - nowPillW / 2));
  const bedX = bedInWindow ? scale.x(bedtime!) : -100;

  // Scrubbed time, clamped into the current window (now keeps moving while it's held).
  const cursorT = scrubAt === null ? null : Math.min(t1, Math.max(t0, scrubAt));
  const cursorMg = cursorT === null ? 0 : Math.round(valueAt(points, cursorT));
  const cursorX = cursorT === null ? -100 : scale.x(cursorT);
  const cursorY = cursorT === null ? baseY : scale.y(valueAt(points, cursorT));
  const cursorText = cursorT === null ? "" : `${cursorMg} mg · ${formatTime(cursorT)}`;
  const cursorPillW = textWidth(cursorText, 13) + 20;
  const cursorPillX = Math.min(width - cursorPillW, Math.max(0, cursorX - cursorPillW / 2));
  const scrubbing = cursorT !== null;
  // Grab handle at the foot of the active line (Now, or the dragged cursor) hints it can be moved.
  const handleX = Math.min(width - HANDLE_R - 1, Math.max(HANDLE_R + 1, scrubbing ? cursorX : nowX));
  const handleY = baseY - HANDLE_R - 3;
  const chevrons = `M${handleX - 2},${handleY - 4} L${handleX - 6},${handleY} L${handleX - 2},${handleY + 4} ` +
    `M${handleX + 2},${handleY - 4} L${handleX + 6},${handleY} L${handleX + 2},${handleY + 4}`;
  const nudge = (minutes: number) =>
    setScrubAt(Math.min(t1, Math.max(t0, (cursorT ?? now) + minutes * 60_000)));

  // Every element keeps a fixed position and an explicit dash setting: react-native-svg
  // can carry a dash pattern over to a different path when siblings are added or removed.
  return (
    <View onLayout={onLayout}>
      <View
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={a11y}
        accessibilityHint="Swipe up or down to check another time"
        accessibilityValue={{ text: scrubbing ? `${cursorMg} mg at ${formatTime(cursorT!)}` : `${nowMg} mg now` }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === "increment" ? 30 : -30)}
      >
      <Svg width={width} height={HEIGHT} pointerEvents="none">
        <Defs>
          <LinearGradient id="caffeinePast" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.3} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0.04} />
          </LinearGradient>
          <LinearGradient id="caffeineFuture" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.12} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        <Line key="base" x1={0} x2={width} y1={baseY - 0.5} y2={baseY - 0.5} stroke={colors.border} strokeWidth={1} strokeDasharray="none" />

        <Path key="pastArea" d={geometry.pastArea} fill="url(#caffeinePast)" />
        <Path key="futureArea" d={geometry.futureArea} fill="url(#caffeineFuture)" />
        <Path key="pastLine" d={geometry.pastLine} stroke={colors.primary} strokeWidth={3}
          strokeLinejoin="round" strokeDasharray="none" fill="none" />
        <Path key="futureLine" d={geometry.futureLine} stroke={colors.primary} strokeWidth={2.5}
          strokeLinejoin="round" strokeDasharray="6 5" fill="none" opacity={0.7} />

        {/* Bed: a quiet dashed line with a label; the mg is on the bedtime tile above. */}
        <Line key="bedLine" x1={bedX} x2={bedX} y1={TOP} y2={baseY} stroke={colors.textMuted}
          strokeWidth={1.5} strokeDasharray="4 4" opacity={bedInWindow ? 1 : 0} />
        <SvgText key="bedLabel" x={bedX - 5} y={TOP + 12} fontSize={12} fontWeight="600" fill={colors.textMuted}
          textAnchor="end" opacity={bedInWindow ? 1 : 0}>Bed</SvgText>

        <SvgText key="empty" x={width / 4} y={TOP + 28} fontSize={13} fill={colors.textMuted}
          textAnchor="middle" opacity={empty ? 1 : 0}>No recent caffeine logged</SvgText>

        {/* Now: fades back while another time is being checked. */}
        <Line key="nowLine" x1={nowX} x2={nowX} y1={TOP - 6} y2={baseY} stroke={colors.text} strokeWidth={1.5}
          strokeDasharray="none" opacity={scrubbing ? 0.25 : 1} />
        <Circle key="nowDot" cx={nowPoint?.x ?? nowX} cy={nowPoint?.y ?? baseY} r={6} fill={colors.primary}
          stroke={colors.surface} strokeWidth={2.5} opacity={scrubbing ? 0.35 : 1} />
        <Rect key="nowPill" x={pillX} y={TOP - 6 - NOW_PILL_H} width={nowPillW} height={NOW_PILL_H}
          rx={NOW_PILL_H / 2} fill={colors.text} opacity={scrubbing ? 0 : 1} />
        <SvgText key="nowText" x={pillX + nowPillW / 2} y={TOP - 6 - NOW_PILL_H / 2 + 4.5} fontSize={13}
          fontWeight="700" fill={colors.surface} textAnchor="middle" opacity={scrubbing ? 0 : 1}>{nowText}</SvgText>

        {/* Dragged cursor */}
        <Line key="cursorLine" x1={cursorX} x2={cursorX} y1={TOP - 6} y2={baseY} stroke={colors.primary}
          strokeWidth={2} strokeDasharray="none" opacity={scrubbing ? 1 : 0} />
        <Circle key="cursorDot" cx={cursorX} cy={cursorY} r={7} fill={colors.primary}
          stroke={colors.surface} strokeWidth={2.5} opacity={scrubbing ? 1 : 0} />
        <Rect key="cursorPill" x={cursorPillX} y={TOP - 6 - NOW_PILL_H} width={cursorPillW} height={NOW_PILL_H}
          rx={NOW_PILL_H / 2} fill={colors.primary} opacity={scrubbing ? 1 : 0} />
        <SvgText key="cursorText" x={cursorPillX + cursorPillW / 2} y={TOP - 6 - NOW_PILL_H / 2 + 4.5} fontSize={13}
          fontWeight="700" fill="#fff" textAnchor="middle" opacity={scrubbing ? 1 : 0}>{cursorText}</SvgText>

        {/* Drag handle */}
        <Circle key="handle" cx={handleX} cy={handleY} r={HANDLE_R} fill={colors.surface}
          stroke={colors.primary} strokeWidth={2} />
        <Path key="handleChevrons" d={chevrons} stroke={colors.primary} strokeWidth={1.75}
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray="none" fill="none" />
      </Svg>
      </View>
      <AxisLabels width={width} ticks={ticks} />

      {scrubbing ? (
        <View style={styles.scrubRow}>
          <Pressable onPress={() => setScrubAt(null)} hitSlop={10} accessibilityRole="button">
            <Text style={styles.resetText}>Back to now</Text>
          </Pressable>
        </View>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  scrubRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8 },
  resetText: { fontSize: 13, fontWeight: "700", color: colors.primary },
});
