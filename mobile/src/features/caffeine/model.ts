import { CaffeineEntry } from "./types";

/**
 * Caffeine elimination half-life. ~5 h is the commonly cited adult average
 * (individual range is roughly 3–7 h). Absorption is treated as immediate,
 * spread evenly over the time the user took to finish the drink.
 */
export const HALF_LIFE_MINUTES = 5 * 60;
/** FDA guidance for healthy adults. */
export const DAILY_LIMIT_MG = 400;
/** Below this at bedtime, caffeine is unlikely to affect sleep much. */
export const BEDTIME_OK_MG = 50;

const K = Math.LN2 / HALF_LIFE_MINUTES;
const MINUTE = 60_000;
const CHUNK_MINUTES = 5;

/** Milligrams of caffeine still in the body at `at` (ms timestamp). */
export function mgInSystem(entries: Pick<CaffeineEntry, "mg" | "consumedAt" | "durationMinutes">[], at: number) {
  let total = 0;
  for (const e of entries) {
    const start = Date.parse(e.consumedAt);
    if (at <= start) continue;
    // Split slow drinks into small chunks so sipping over an hour is modelled as such.
    const duration = Math.max(0, e.durationMinutes);
    const chunks = Math.max(1, Math.ceil(duration / CHUNK_MINUTES));
    const dose = e.mg / chunks;
    for (let i = 0; i < chunks; i++) {
      const t = start + ((i + 0.5) * duration * MINUTE) / chunks;
      if (t >= at) break;
      total += dose * Math.exp(-K * ((at - t) / MINUTE));
    }
  }
  return total;
}

/** Sampled caffeine curve between two timestamps. */
export function caffeineCurve(entries: CaffeineEntry[], from: number, to: number, stepMinutes = 10) {
  const points: { t: number; mg: number }[] = [];
  for (let t = from; t <= to; t += stepMinutes * MINUTE) points.push({ t, mg: mgInSystem(entries, t) });
  return points;
}
