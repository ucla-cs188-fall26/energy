/**
 * PLACEHOLDER ENERGY FORECAST — not a real model.
 *
 * A hand-tuned curve shaped like a typical day so the Home screen can be
 * reviewed with plausible, time-aware numbers: low just after waking, a
 * mid-afternoon dip ~9.5 h after wake, and a decline toward bedtime. It does
 * not use sleep, caffeine or anything else about the user except wake time.
 * Replace with the real energy model.
 */

const HOUR = 3_600_000;

export function energyAt(t: number, wake: number) {
  const h = (t - wake) / HOUR;
  const inertia = -20 * Math.exp(-Math.max(0, h) / 0.6);
  const dip = -22 * Math.exp(-((h - 9.5) ** 2) / (2 * 1.3 ** 2));
  const evening = -35 / (1 + Math.exp(-(h - 15) / 1.2));
  return Math.max(0, Math.min(100, 88 + inertia + dip + evening));
}

export type Forecast = {
  now: number;
  points: { t: number; value: number }[];
  /** Lowest point of the next dip before bedtime, if there is one. */
  dip: number | null;
  /** Hours until energy falls noticeably below the current level. */
  steadyHours: number | null;
};

const STEP = 10 * 60_000;
const NOTICEABLE_DROP = 10;

export function forecast(now: number, wake: number, bedtime: number): Forecast {
  const end = Math.max(bedtime, now + HOUR);
  const points: Forecast["points"] = [];
  for (let t = now; t <= end; t += STEP) points.push({ t, value: energyAt(t, wake) });

  const current = points[0].value;
  // First local minimum at least 5 points below the highest level before it
  // (a real dip, not just the slide into bedtime).
  let dip: number | null = null;
  let peak = current;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    peak = Math.max(peak, p.value);
    if (p.value < points[i - 1].value && p.value <= points[i + 1].value && peak - p.value >= 5) {
      dip = p.t;
      break;
    }
  }
  const drop = points.find((p) => current - p.value >= NOTICEABLE_DROP);
  return { now: current, points, dip, steadyHours: drop ? (drop.t - now) / HOUR : null };
}

const DAY = 24 * HOUR;

export type HomeForecast = Forecast & {
  /** True between bedtime and the next wake time; the forecast is then for tomorrow. */
  night: boolean;
  start: number;
};

/**
 * Forecast for the Home screen: from now until bedtime during the day, or
 * tomorrow's whole waking day once bedtime has passed.
 */
export function homeForecast(now: number, wake: number, bedtime: number): HomeForecast {
  if (now < bedtime) return { ...forecast(now, wake, bedtime), night: false, start: now };
  let nextWake = wake + DAY;
  while (nextWake <= now) nextWake += DAY;
  const next = forecast(nextWake, nextWake, nextWake + (bedtime - wake));
  // Keep the ring showing the current (late-evening) level, not tomorrow's.
  return { ...next, now: energyAt(now, wake), night: true, start: nextWake };
}

export function energyStatus(value: number) {
  if (value >= 70) return "You’re in a good spot";
  if (value >= 50) return "Your energy is dipping";
  return "You’re running low";
}
