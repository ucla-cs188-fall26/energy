import { useState } from "react";
import { LayoutChangeEvent } from "react-native";

export type Scale = { x: (t: number) => number; y: (v: number) => number };

export function makeScale(
  width: number, height: number,
  domain: { t0: number; t1: number; v0: number; v1: number },
  pad = { top: 0, bottom: 0 },
): Scale {
  const { t0, t1, v0, v1 } = domain;
  const plotH = height - pad.top - pad.bottom;
  return {
    x: (t) => ((t - t0) / (t1 - t0 || 1)) * width,
    y: (v) => pad.top + (1 - (v - v0) / (v1 - v0 || 1)) * plotH,
  };
}

/** SVG path through the points, smoothed with Catmull-Rom curves. */
export function smoothPath(pts: { x: number; y: number }[]) {
  if (!pts.length) return "";
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Measures a view's width so charts can draw at the available size. */
export function useWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  return [width, (e) => setWidth(Math.round(e.nativeEvent.layout.width))];
}
