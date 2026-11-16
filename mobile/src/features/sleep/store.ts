import { create } from "zustand";
import { SessionRecord, trackingApi } from "@/services/api";
import { trackingScope } from "@/services/tracking-scope";

export type SleepSession = { id: string; startedAt: string; endedAt: string; quality: number | null };
export type Nap = SleepSession;
type ActiveSession = { id: string; startedAt: string };
const completed = (r: SessionRecord): SleepSession => ({ id: r.id, startedAt: r.started_at,
  endedAt: r.ended_at!, quality: r.sleep_quality ?? r.refreshed_rating ?? null });
const active = (r: SessionRecord | null): ActiveSession | null => r ? { id: r.id, startedAt: r.started_at } : null;
export const MIN_SESSION_MINUTES = 5;
export const CYCLE_MINUTES = 90;

type SleepState = {
  active: ActiveSession | null; activeNap: ActiveSession | null;
  sessions: SleepSession[]; naps: Nap[];
  reset: () => void; refresh: () => Promise<void>;
  startSleep: () => Promise<void>; stopSleep: () => Promise<SleepSession | null>;
  startNap: () => Promise<void>; stopNap: (rating?: number) => Promise<void>;
  logNap: (nap: { startedAt: string; endedAt: string; quality?: number }) => Promise<void>;
  rateSleep: (id: string, rating: number) => Promise<void>;
  rateNap: (id: string, rating: number) => Promise<void>;
};
// Supabase is the source of truth. Old anonymous device records are not uploaded
// or reused across accounts. An active session is restored from the API on login.
export const useSleepStore = create<SleepState>((set, get) => {
  async function update<T>(work: () => Promise<T>, apply: (result: T) => void, mutation = true): Promise<T> {
    const scope = trackingScope.version;
    const revision = trackingScope.revision;
    const result = await work();
    if (scope === trackingScope.version && (mutation || revision === trackingScope.revision)) {
      if (mutation) trackingScope.revision += 1;
      apply(result);
    }
    return result;
  }
  return {
    active: null, activeNap: null, sessions: [], naps: [],
    reset: () => set({ active: null, activeNap: null, sessions: [], naps: [] }),
    refresh: () => update(() => Promise.all([trackingApi.sleepHistory(), trackingApi.napHistory(),
      trackingApi.activeSleep(), trackingApi.activeNap()]), ([sleep, naps, sleeping, napping]) => {
      set({ sessions: sleep.map(completed), naps: naps.map(completed), active: active(sleeping), activeNap: active(napping) });
    }, false).then(() => undefined),
    startSleep: async () => {
      if (get().active) return;
      await update(trackingApi.startSleep, (r) => set({ active: active(r) }));
    },
    stopSleep: async () => {
      const current = get().active;
      if (!current) return null;
      const row = await update(() => trackingApi.stopSleep(current.id), (r) => set((s) => ({
        active: null, sessions: [...s.sessions.filter(x => x.id !== r.id), completed(r)],
      })));
      return completed(row);
    },
    startNap: async () => {
      if (get().activeNap) return;
      await update(trackingApi.startNap, (r) => set({ activeNap: active(r) }));
    },
    stopNap: async (rating) => {
      const current = get().activeNap;
      if (!current) return;
      await update(() => trackingApi.stopNap(current.id, rating), (r) => set((s) => ({
        activeNap: null, naps: [...s.naps.filter(x => x.id !== r.id), completed(r)],
      })));
    },
    logNap: async (nap) => {
      await update(() => trackingApi.logNap(nap.startedAt, nap.endedAt, nap.quality), (r) =>
        set((s) => ({ naps: [...s.naps, completed(r)] })));
    },
    rateSleep: async (id, rating) => {
      await update(() => trackingApi.rateSleep(id, rating), (r) => set((s) => ({
        sessions: s.sessions.map(x => x.id === id ? completed(r) : x),
      })));
    },
    rateNap: async (id, rating) => {
      await update(() => trackingApi.rateNap(id, rating), (r) => set((s) => ({
        naps: s.naps.map(x => x.id === id ? completed(r) : x),
      })));
    },
  };
});

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
