import { View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { AxisLabels } from "@/components/AxisLabels";
import { makeScale, smoothPath, useWidth } from "@/components/charts";
import { formatHour } from "@/features/schedule";
import { colors } from "@/utils/theme";
import { Forecast } from "./forecast";

const HEIGHT = 96;
const DIP_FILL = "#FDF1E3";
const HOUR = 3_600_000;

/** `startLabel` names the left edge: "Now" for today, the wake time for tomorrow. */
export function ForecastChart({ forecast, startLabel = "Now" }: { forecast: Forecast; startLabel?: string }) {
  const [width, onLayout] = useWidth();
  const { points, dip } = forecast;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const values = points.map((p) => p.value);
  const v0 = Math.min(...values) - 4;
  const v1 = Math.max(...values) + 4;
  const scale = makeScale(width, HEIGHT, { t0, t1, v0, v1 }, { top: 8, bottom: 8 });
  const line = smoothPath(points.map((p) => ({ x: scale.x(p.t), y: scale.y(p.value) })));

  // "Now", two evenly spaced whole hours, and the end of the day.
  const span = t1 - t0;
  const middle = [1, 2].map((i) => Math.round((t0 + (span * i) / 3) / HOUR) * HOUR);
  const ticks = [
    { x: 0, label: startLabel },
    ...middle.map((t) => ({ x: scale.x(t), label: formatHour(t) })),
    { x: width, label: formatHour(Math.round(t1 / HOUR) * HOUR) },
  ];

  return (
    <View onLayout={onLayout}>
      {width > 0 ? (
        <>
          <Svg width={width} height={HEIGHT}>
            {dip != null ? (
              <Rect
                x={Math.max(0, scale.x(dip - 0.75 * HOUR))}
                y={0}
                width={scale.x(dip + 0.75 * HOUR) - Math.max(0, scale.x(dip - 0.75 * HOUR))}
                height={HEIGHT}
                rx={12}
                fill={DIP_FILL}
              />
            ) : null}
            <Path d={line} stroke={colors.primary} strokeWidth={3.5} fill="none" strokeLinecap="round" />
            <Circle cx={3} cy={scale.y(points[0].value)} r={5} fill={colors.primary} />
          </Svg>
          <AxisLabels width={width} ticks={ticks} />
        </>
      ) : <View style={{ height: HEIGHT + 30 }} />}
    </View>
  );
}
