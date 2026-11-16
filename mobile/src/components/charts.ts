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

/** SVG path with straight segments; never overshoots sudden jumps (e.g. a new drink). */
export function linePath(pts: { x: number; y: number }[]) {
  return pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
}

export type MarkerLabel = { x: number; anchor: "start" | "end" } | null;

/**
 * Places the "Now" and "Bed" labels beside their vertical lines so they stay
 * on the chart and don't overlap. Tries each label on either side of its line,
 * preferring Now-right / Bed-left; if nothing fits, the Bed label is hidden.
 * Widths are approximate rendered text widths in px.
 */
export function placeMarkerLabels(
  width: number, nowX: number, bedX: number,
  nowWidth = 36, bedWidth = 32, gap = 6,
): { now: MarkerLabel; bed: MarkerLabel } {
  const span = (x: number, side: "right" | "left", w: number) =>
    side === "right" ? { from: x + gap, to: x + gap + w } : { from: x - gap - w, to: x - gap };
  const fits = (s: { from: number; to: number }) => s.from >= 0 && s.to <= width;
  const label = (x: number, side: "right" | "left"): MarkerLabel =>
    ({ x: side === "right" ? x + gap : x - gap, anchor: side === "right" ? "start" : "end" });

  const options: ["right" | "left", "right" | "left"][] =
    [["right", "left"], ["left", "right"], ["left", "left"], ["right", "right"]];
  for (const [nowSide, bedSide] of options) {
    const a = span(nowX, nowSide, nowWidth);
    const b = span(bedX, bedSide, bedWidth);
    if (fits(a) && fits(b) && (a.to + 4 <= b.from || b.to + 4 <= a.from)) {
      return { now: label(nowX, nowSide), bed: label(bedX, bedSide) };
    }
  }
  const nowSide = fits(span(nowX, "right", nowWidth)) ? "right" : "left";
  return { now: label(nowX, nowSide), bed: null };
}
