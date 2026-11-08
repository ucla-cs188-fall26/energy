import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { CaffeineEntry, NewCaffeineEntry } from "./types";

type CaffeineState = {
  entries: CaffeineEntry[];
  addEntry: (entry: NewCaffeineEntry) => void;
  removeEntry: (id: string) => void;
};

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Saved on the device for now; this will sync to the backend in a later step.
export const useCaffeineStore = create<CaffeineState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) => set((s) => ({ entries: [...s.entries, { ...entry, id: makeId() }] })),
      removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
    }),
    {
      name: "caffeine-entries",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ entries: s.entries }),
      // v0 entries had `presetId` and no `durationMinutes`.
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as { entries?: Partial<CaffeineEntry>[] };
        if (version < 1) {
          state.entries = (state.entries ?? []).map((e) => ({ durationMinutes: 10, ...e }));
        }
        return state as Pick<CaffeineState, "entries">;
      },
    },
  ),
);

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Today's entries, newest first. */
export function useTodayEntries() {
  const entries = useCaffeineStore((s) => s.entries);
  return useMemo(() => {
    const start = startOfToday();
    return entries
      .filter((e) => new Date(e.consumedAt).getTime() >= start)
      .sort((a, b) => b.consumedAt.localeCompare(a.consumedAt));
  }, [entries]);
}

export function useTodayTotalMg() {
  const today = useTodayEntries();
  return useMemo(() => today.reduce((sum, e) => sum + e.mg, 0), [today]);
}
