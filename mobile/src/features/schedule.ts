/** Helpers for the user's daily sleep schedule (times are minutes after local midnight). */

const MINUTE = 60_000;
const DAY_MINUTES = 24 * 60;

/** Timestamp of the most recent occurrence of a clock time at or before `now`. */
export function lastOccurrence(clockMinutes: number, now: number) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  let t = d.getTime() + clockMinutes * MINUTE;
  if (t > now) t -= DAY_MINUTES * MINUTE;
  return t;
}

/** Timestamp of the next occurrence of a clock time after `now`. */
export function nextOccurrence(clockMinutes: number, now: number) {
  return lastOccurrence(clockMinutes, now) + DAY_MINUTES * MINUTE;
}

/**
 * The user's current waking day: from their most recent wake time to the
 * bedtime that follows it. Late at night (after bedtime, before wake) this is
 * still the day that just ended.
 */
export function wakingDay(wakeMinutes: number, bedtimeMinutes: number, now: number) {
  const wake = lastOccurrence(wakeMinutes, now);
  const awakeMinutes = ((bedtimeMinutes - wakeMinutes) % DAY_MINUTES + DAY_MINUTES) % DAY_MINUTES || DAY_MINUTES;
  return { wake, bedtime: wake + awakeMinutes * MINUTE };
}

export function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** "4 PM" for whole hours, "4:30 PM" otherwise. */
export function formatHour(ms: number) {
  const d = new Date(ms);
  return d.getMinutes() === 0
    ? d.toLocaleTimeString([], { hour: "numeric" })
    : formatTime(ms);
}

export function formatDuration(minutes: number) {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  if (!h) return `${m}m`;
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}
