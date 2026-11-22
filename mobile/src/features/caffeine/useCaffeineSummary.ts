import { useMemo } from "react";

import { useProfileSettings } from "@/features/profile/store";
import { nextBedtime, wakingDay } from "@/features/schedule";
import { noRecentDoses, sampleWindow } from "./chartWindow";
import { mgInSystem } from "./model";
import { useCaffeineStore, useTodayTotalMg } from "./store";

/** Caffeine numbers for the current waking day, shared by Home, Sleep and Caffeine. */
export function useCaffeineSummary(now: number) {
  const entries = useCaffeineStore((s) => s.entries);
  const todayMg = useTodayTotalMg(now);
  const { wakeMinutes, bedtimeMinutes } = useProfileSettings();

  // Recomputes when doses change and on each clock tick (useNow, ~1 min), never per frame.
  return useMemo(() => {
    // Recompute immediately on mutations, without waiting for the clock tick.
    const current = Math.max(now, Date.now());
    const { wake } = wakingDay(wakeMinutes, bedtimeMinutes, current);
    // Always the upcoming bedtime, so this is a projection, never a past value.
    const bedtime = nextBedtime(bedtimeMinutes, current);
    const inSystem = mgInSystem(entries, current);
    return {
      todayMg,
      inSystemMg: Math.round(inSystem),
      atBedtimeMg: Math.round(bedtime === null ? inSystem : mgInSystem(entries, bedtime)),
      wake,
      bedtime,
      /** Center of the chart window; the curve's middle sample. */
      chartNow: current,
      curve: sampleWindow(entries, current),
      noRecentDoses: noRecentDoses(entries, current),
    };
  }, [entries, todayMg, wakeMinutes, bedtimeMinutes, now]);
}
