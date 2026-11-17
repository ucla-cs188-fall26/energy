import { useMemo } from "react";

import { SleepSession, useSleepStore } from "./store";

export type RatingKind = "sleep" | "nap";
export type PendingRating = { kind: RatingKind; session: SleepSession };

/** Sessions that ended longer ago than this are no longer asked about. */
const ASK_WITHIN_MS = 24 * 3_600_000;

/**
 * Set while a Stop button is sending the user to the rating screen itself,
 * so the tab-level check doesn't open a second copy at the same time.
 */
export const ratingPrompt = { open: false };

/** The most recent sleep or nap from the last day that still needs a rating. */
export function findPendingRating(sessions: SleepSession[], naps: SleepSession[], now: number): PendingRating | null {
  const candidates: PendingRating[] = [
    ...sessions.map((session) => ({ kind: "sleep" as const, session })),
    ...naps.map((session) => ({ kind: "nap" as const, session })),
  ].filter(({ session }) => {
    const ended = Date.parse(session.endedAt);
    return session.quality == null && ended <= now && now - ended <= ASK_WITHIN_MS;
  });
  return candidates.sort((a, b) => b.session.endedAt.localeCompare(a.session.endedAt))[0] ?? null;
}

export function usePendingRating() {
  const sessions = useSleepStore((s) => s.sessions);
  const naps = useSleepStore((s) => s.naps);
  return useMemo(() => findPendingRating(sessions, naps, Date.now()), [sessions, naps]);
}
