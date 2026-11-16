import { CaffeineEntry } from "./types";

/**
 * Caffeine elimination half-life. ~5 h is the commonly cited adult average
 * (individual range is roughly 3–7 h). Remaining mg uses immediate-dose elimination, matching the API. The backend
 * applies a separate onset ramp to its alertness contribution.
 */
export const HALF_LIFE_MINUTES = 5 * 60;
/** FDA guidance for healthy adults. */
export const DAILY_LIMIT_MG = 400;
/** Provisional UI color threshold, not an individual safe-sleep limit. */
export const BEDTIME_OK_MG = 50;

const K = Math.LN2 / HALF_LIFE_MINUTES;
const MINUTE = 60_000;
/** Milligrams remaining from each logged dose (not absorbed or effective mg). */
export function mgInSystem(entries: Pick<CaffeineEntry, "mg" | "consumedAt" | "durationMinutes">[], at: number) {
  return entries.reduce((total, e) => {
    const minutes = (at - Date.parse(e.consumedAt)) / MINUTE;
    return minutes < 0 ? total : total + e.mg * Math.exp(-K * minutes);
  }, 0);
}

/** Sampled caffeine curve between two timestamps. */
export function caffeineCurve(entries: CaffeineEntry[], from: number, to: number, stepMinutes = 10) {
  const points: { t: number; mg: number }[] = [];
  for (let t = from; t <= to; t += stepMinutes * MINUTE) points.push({ t, mg: mgInSystem(entries, t) });
  return points;
}
