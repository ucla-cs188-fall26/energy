import { View } from "react-native";
import Svg, { Line, Path, Text as SvgText } from "react-native-svg";

import { AxisLabels } from "@/components/AxisLabels";
import { makeScale, smoothPath, useWidth } from "@/components/charts";
import { formatHour } from "@/features/schedule";
import { colors } from "@/utils/theme";

const HEIGHT = 170;
const TOP = 24;
const HOUR = 3_600_000;
const FILL = "#ECE8FB";

type Props = { points: { t: number; mg: number }[]; now: number; bedtime: number };

export function CaffeineChart({ points, now, bedtime }: Props) {
  const [width, onLayout] = useWidth();
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const peak = Math.max(50, ...points.map((p) => p.mg));
  const scale = makeScale(width, HEIGHT, { t0, t1, v0: 0, v1: peak * 1.05 }, { top: TOP, bottom: 0 });
  const xy = points.map((p) => ({ x: scale.x(p.t), y: scale.y(p.mg) }));
  const line = smoothPath(xy);
  const area = `${line} L${width},${HEIGHT} L0,${HEIGHT} Z`;
  const nowX = Math.min(width - 1, Math.max(1, scale.x(now)));
  const bedX = scale.x(bedtime);

  // Start of day, every 6 hours after, and the end.
  const ticks = [{ x: 0, label: formatHour(t0) }];
  for (let t = Math.ceil(t0 / HOUR) * HOUR + 6 * HOUR; t < t1 - 2 * HOUR; t += 6 * HOUR) {
    ticks.push({ x: scale.x(t), label: formatHour(t) });
  }
  ticks.push({ x: width, label: formatHour(Math.round(t1 / HOUR) * HOUR) });

  return (
    <View onLayout={onLayout} accessibilityLabel="Caffeine in your system over today">
      {width > 0 ? (
        <>
          <Svg width={width} height={HEIGHT}>
            <Path d={area} fill={FILL} />
            <Path d={line} stroke={colors.primary} strokeWidth={3} fill="none" />
            <Line x1={bedX} x2={bedX} y1={TOP} y2={HEIGHT} stroke={colors.textMuted} strokeWidth={1.5} strokeDasharray="5 5" />
            <SvgText x={bedX - 6} y={TOP - 8} fontSize={14} fill={colors.textMuted} textAnchor="end">Bed</SvgText>
            <Line x1={nowX} x2={nowX} y1={TOP - 20} y2={HEIGHT} stroke={colors.text} strokeWidth={2} />
            <SvgText x={nowX + 6} y={TOP - 8} fontSize={14} fontWeight="700" fill={colors.text}>Now</SvgText>
          </Svg>
          <AxisLabels width={width} ticks={ticks} />
        </>
      ) : <View style={{ height: HEIGHT + 30 }} />}
    </View>
  );
}
