/** Volatile preview only: never updates tracking stores, storage, or real history. */
import { create } from "zustand";
import { localTimezone, Prediction, request } from "./api";
import { trackingScope } from "./tracking-scope";

export type SimulationPrediction = Prediction & { simulation: true; simulated_sleep_minutes: number };
type SimulationState = {
  prediction: SimulationPrediction | null; scope: number; loading: boolean; error: string | null;
  simulate: (minutes: number) => Promise<boolean>; reset: () => void;
};
let generation = 0;
export const useDevelopmentSimulation = create<SimulationState>((set) => ({
  prediction: null, scope: -1, loading: false, error: null,
  reset: () => { generation++; set({ prediction: null, scope: -1, loading: false, error: null }); },
  simulate: async (minutes) => {
    if (typeof __DEV__ === "undefined" || !__DEV__) return false;
    if (!trackingScope.owner) { set({ error: "Please sign in first." }); return false; }
    const current = ++generation;
    const scope = trackingScope.version;
    set({ loading: true, error: null });
    try {
      const prediction = await request<SimulationPrediction>("/development/energy/simulate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duration_minutes: minutes, timezone: localTimezone() }),
      }, "Simulation unavailable. Set ENERGY_ENVIRONMENT=development on the local backend and restart it.");
      if (current !== generation || scope !== trackingScope.version) return false;
      if (prediction.simulation !== true || prediction.simulated_sleep_minutes !== minutes) {
        throw new Error("Invalid simulation response. Please try again.");
      }
      set({ prediction, scope, loading: false });
      return true;
    } catch (cause) {
      if (current === generation && scope === trackingScope.version) set({
        loading: false, error: cause instanceof Error ? cause.message : "Unable to simulate sleep.",
      });
      return false;
    }
  },
}));
