import { useMemo } from "react";
import { create } from "zustand";
import { BeveragePreset, CaffeineRecord, trackingApi } from "@/services/api";
import { trackingScope } from "@/services/tracking-scope";
import { CaffeineEntry, NewCaffeineEntry } from "./types";

const present = (r: CaffeineRecord): CaffeineEntry => ({ id: r.id, name: r.beverage_name,
  mg: Number(r.caffeine_mg), consumedAt: r.consumed_at, servingSizeMl: Number(r.serving_size_ml), durationMinutes: 0 });
// The API stores amounts as numeric(10, 2) and rejects more than two decimal places.
const round2 = (n: number | undefined) => n === undefined ? n : Math.round(n * 100) / 100;
function body(e: NewCaffeineEntry) {
  return { beverage_name: e.name.trim(), caffeine_mg: round2(e.mg), serving_size_ml: round2(e.servingSizeMl),
    consumed_at: e.consumedAt, logging_method: e.presetId ? "preset" : "manual",
    ...(e.presetId ? { preset_id: e.presetId } : {}) };
}
type CaffeineState = {
  entries: CaffeineEntry[]; presets: BeveragePreset[];
  reset: () => void; refresh: () => Promise<void>;
  addEntry: (entry: NewCaffeineEntry) => Promise<void>;
  updateEntry: (entry: CaffeineEntry) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
};
export const useCaffeineStore = create<CaffeineState>((set) => {
  async function update<T>(work: () => Promise<T>, apply: (result: T) => void, mutation = true) {
    const scope = trackingScope.version;
    const revision = trackingScope.revision;
    const result = await work();
    if (scope === trackingScope.version && (mutation || revision === trackingScope.revision)) {
      if (mutation) trackingScope.revision += 1;
      apply(result);
    }
  }
  return {
    entries: [], presets: [], reset: () => set({ entries: [], presets: [] }),
    refresh: () => update(() => Promise.all([trackingApi.caffeineHistory(), trackingApi.presets()]),
      ([rows, presets]) => set({ entries: rows.map(present), presets }), false),
    addEntry: (entry) => update(() => trackingApi.addCaffeine(body(entry)), (r) =>
      set((s) => ({ entries: [...s.entries, present(r)] }))),
    updateEntry: (entry) => update(() => trackingApi.updateCaffeine(entry.id, {
      beverage_name: entry.name.trim(), caffeine_mg: round2(entry.mg), serving_size_ml: round2(entry.servingSizeMl),
      consumed_at: entry.consumedAt,
    }), (r) => set((s) => ({ entries: s.entries.map(e => e.id === r.id ? present(r) : e) }))),
    removeEntry: (id) => update(() => trackingApi.deleteCaffeine(id), () =>
      set((s) => ({ entries: s.entries.filter(e => e.id !== id) }))),
  };
});

function startOfToday(now: number) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Today's entries, newest first. */
export function useTodayEntries(now = Date.now()) {
  const entries = useCaffeineStore((s) => s.entries);
  return useMemo(() => {
    // A screen clock may be up to a minute old when a save completes.
    const current = Math.max(now, Date.now());
    const start = startOfToday(current);
    return entries
      .filter((e) => new Date(e.consumedAt).getTime() >= start && new Date(e.consumedAt).getTime() <= current)
      .sort((a, b) => b.consumedAt.localeCompare(a.consumedAt));
  }, [entries, now]);
}

export function useTodayTotalMg(now = Date.now()) {
  const today = useTodayEntries(now);
  return useMemo(() => today.reduce((sum, e) => sum + e.mg, 0), [today]);
}
