import { mgInSystem } from "./model";
import { CaffeineEntry } from "./types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** The chart spans this long on each side of now, so now is always the center. */
export const CHART_HALF_SPAN_MS = 12 * HOUR;
export const CHART_STEP_MINUTES = 10;
/** Smallest y-axis top, so a tiny dose (or none) doesn't fill the chart. */
export const CHART_MIN_Y_MG = 100;

type Dose = Pick<CaffeineEntry, "mg" | "consumedAt" | "durationMinutes">;
export type ChartPoint = { t: number; mg: number };

export function chartWindow(now: number) {
  return { t0: now - CHART_HALF_SPAN_MS, t1: now + CHART_HALF_SPAN_MS };
}

/**
 * Samples the curve across the window centered on now. Uses every dose, including
 * ones before the window start, since they still contribute. `now` is always a sample.
 * Each drink also gets a point just before and at its time, so it draws as a clean
 * vertical step at the moment it was drunk instead of a slanted ramp between samples.
 */
export function sampleWindow(entries: Dose[], now: number, stepMinutes = CHART_STEP_MINUTES): ChartPoint[] {
  const { t0, t1 } = chartWindow(now);
  const step = stepMinutes * MINUTE;
  const times = new Set<number>();
  for (let t = t0; t <= t1; t += step) times.add(t);
  for (const e of entries) {
    const t = Date.parse(e.consumedAt);
    if (t > t0 && t <= t1) {
      times.add(t - 1);
      times.add(t);
    }
  }
  // Exactly mgInSystem, so the line, Now dot and label match the "In system now" tile.
  return [...times].sort((a, b) => a - b).map((t) => ({ t, mg: mgInSystem(entries, t) }));
}

/** Gridline spacing for a given y-axis top. */
export function yStep(max: number) {
  return max <= 200 ? 50 : max <= 400 ? 100 : 200;
}

/**
 * Y-axis top: the peak plus ~15% headroom, rounded up to a gridline, so the
 * curve fills the chart instead of hugging the bottom.
 */
export function yMax(points: ChartPoint[]) {
  const target = Math.max(CHART_MIN_Y_MG, ...points.map((p) => p.mg * 1.15));
  const step = yStep(target);
  return Math.ceil(target / step) * step;
}

/** True when nothing was logged in the 24 hours before now. */
export function noRecentDoses(entries: Dose[], now: number) {
  return !entries.some((e) => {
    const t = Date.parse(e.consumedAt);
    return t <= now && t >= now - 2 * CHART_HALF_SPAN_MS;
  });
}

/** Whole hours every 6 hours, anchored on the hour nearest now, inside the window. */
export function axisTicks(now: number) {
  const { t0, t1 } = chartWindow(now);
  const anchor = Math.round(now / HOUR) * HOUR;
  const ticks: number[] = [];
  for (let k = -2; k <= 2; k++) {
    const t = anchor + k * 6 * HOUR;
    if (t >= t0 - HOUR / 2 && t <= t1 + HOUR / 2) ticks.push(t);
  }
  return ticks;
}

/** Scrubbing snaps to this many minutes so labels read cleanly ("8:35 AM", not "8:37 AM"). */
export const SCRUB_STEP_MINUTES = 5;

/**
 * Time under a touch at `x` (0..width) on the chart, snapped to SCRUB_STEP_MINUTES and
 * kept inside the window.
 */
export function scrubTime(x: number, width: number, now: number) {
  const { t0, t1 } = chartWindow(now);
  const frac = width > 0 ? Math.min(1, Math.max(0, x / width)) : 0.5;
  const step = SCRUB_STEP_MINUTES * MINUTE;
  const t = Math.round((t0 + frac * (t1 - t0)) / step) * step;
  // Clamp to the snapped times just inside the window, so edges stay on the 5-minute grid.
  return Math.min(Math.floor(t1 / step) * step, Math.max(Math.ceil(t0 / step) * step, t));
}

/** The drawn line's value at `t`: linear between the two surrounding samples. */
export function valueAt(points: ChartPoint[], t: number) {
  if (!points.length) return 0;
  if (t <= points[0].t) return points[0].mg;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (t <= b.t) return b.t === a.t ? b.mg : a.mg + ((t - a.t) / (b.t - a.t)) * (b.mg - a.mg);
  }
  return points[points.length - 1].mg;
}
