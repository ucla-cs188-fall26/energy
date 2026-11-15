import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SleepSession = { id: string; startedAt: string; endedAt: string };
/** Naps are logged after the fact and kept apart from nightly sleep. */
export type Nap = SleepSession;

type SleepState = {
  /** Set while the user is asleep (between Start sleep and Stop sleep). */
  active: { startedAt: string } | null;
  sessions: SleepSession[];
  naps: Nap[];
  logNap: (nap: { startedAt: string; endedAt: string }) => void;
  removeNap: (id: string) => void;
  startSleep: () => void;
  /** Ends the active session; returns it, or null if it was too short to keep. */
  stopSleep: () => SleepSession | null;
};

/** Sessions shorter than this are treated as accidental taps and discarded. */
export const MIN_SESSION_MINUTES = 5;
/** Typical sleep-cycle length used for cycle estimates. */
export const CYCLE_MINUTES = 90;

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Saved on the device for now, like caffeine entries.
export const useSleepStore = create<SleepState>()(
  persist(
    (set, get) => ({
      active: null,
      sessions: [],
      naps: [],
      logNap: (nap) => set((s) => ({ naps: [...s.naps, { ...nap, id: makeId() }] })),
      removeNap: (id) => set((s) => ({ naps: s.naps.filter((n) => n.id !== id) })),
      startSleep: () => {
        if (!get().active) set({ active: { startedAt: new Date().toISOString() } });
      },
      stopSleep: () => {
        const { active, sessions } = get();
        if (!active) return null;
        const endedAt = new Date().toISOString();
        const minutes = (Date.parse(endedAt) - Date.parse(active.startedAt)) / 60_000;
        if (minutes < MIN_SESSION_MINUTES) {
          set({ active: null });
          return null;
        }
        const session = { id: makeId(), startedAt: active.startedAt, endedAt };
        set({ active: null, sessions: [...sessions, session] });
        return session;
      },
    }),
    {
      name: "sleep-sessions",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ active, sessions, naps }) => ({ active, sessions, naps }),
      // v0 had no naps.
      version: 1,
      migrate: (persisted) => {
        const state = persisted as Partial<Pick<SleepState, "active" | "sessions" | "naps">>;
        return { active: state.active ?? null, sessions: state.sessions ?? [], naps: state.naps ?? [] };
      },
    },
  ),
);

export function sessionMinutes(s: Pick<SleepSession, "startedAt" | "endedAt">) {
  return (Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60_000;
}

/** Completed cycles, assuming ~90-minute cycles. */
export function estimateCycles(minutes: number) {
  return Math.floor(minutes / CYCLE_MINUTES);
}

/** Most recent completed session, if any. */
export function useLastSleep() {
  return useSleepStore((s) => s.sessions.reduce<SleepSession | null>(
    (latest, x) => (!latest || x.endedAt > latest.endedAt ? x : latest), null,
  ));
}

// PLACEHOLDER: no sleep-stage detection exists yet. These match the design so
// the UI can be reviewed; replace with real values when sleep tracking lands.
export const PLACEHOLDER_QUALITY = 4;
export const PLACEHOLDER_STAGES = [
  { stage: "light", share: 0.52 },
  { stage: "deep", share: 0.23 },
  { stage: "rem", share: 0.25 },
] as const;
