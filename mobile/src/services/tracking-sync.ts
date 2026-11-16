import { create } from "zustand";
import { Prediction, trackingApi } from "./api";
import { trackingScope } from "./tracking-scope";
import { useSleepStore } from "@/features/sleep/store";
import { useCaffeineStore } from "@/features/caffeine/store";

type SyncState = { prediction: Prediction | null; loading: boolean; error: string | null;
  refresh: () => Promise<void>; reset: () => void };
let pending: { scope: number; revision: number; promise: Promise<void> } | null = null;
export const useTrackingSync = create<SyncState>((set) => ({
  prediction: null, loading: false, error: null,
  reset: () => set({ prediction: null, loading: false, error: null }),
  refresh: (): Promise<void> => {
    const scope = trackingScope.version;
    const revision = trackingScope.revision;
    if (!trackingScope.owner) return Promise.resolve();
    if (pending?.scope === scope && pending.revision === revision) return pending.promise;
    set({ loading: true, error: null });
    const promise: Promise<void> = (async (): Promise<void> => {
      const results = await Promise.allSettled([useSleepStore.getState().refresh(),
        useCaffeineStore.getState().refresh(), trackingApi.prediction()]);
      if (scope !== trackingScope.version) return;
      if (revision !== trackingScope.revision) return useTrackingSync.getState().refresh();
      const prediction = results[2];
      set({ prediction: prediction.status === "fulfilled" ? prediction.value as Prediction : null,
        loading: false, error: results.some(r => r.status === "rejected")
          ? "Some data could not sync. Check your connection and tap Retry." : null });
    })().finally(() => { if (pending?.promise === promise) pending = null; });
    pending = { scope, revision, promise };
    return promise;
  },
}));
