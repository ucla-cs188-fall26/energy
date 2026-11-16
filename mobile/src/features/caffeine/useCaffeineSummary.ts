import { useMemo } from "react";

import { useProfileSettings } from "@/features/profile/store";
import { wakingDay } from "@/features/schedule";
import { caffeineCurve, mgInSystem } from "./model";
import { useCaffeineStore, useTodayTotalMg } from "./store";

const HOUR = 3_600_000;

/** Caffeine numbers for the current waking day, shared by Home, Sleep and Caffeine. */
export function useCaffeineSummary(now: number) {
  const entries = useCaffeineStore((s) => s.entries);
  const todayMg = useTodayTotalMg(now);
  const { wakeMinutes, bedtimeMinutes } = useProfileSettings();

  return useMemo(() => {
    // Recompute immediately on mutations, without waiting for the clock tick.
    const current = Math.max(now, Date.now());
    const { wake, bedtime } = wakingDay(wakeMinutes, bedtimeMinutes, current);
    // Show an hour past bedtime, or a little past now if the user is up late.
    const end = Math.max(bedtime + HOUR, current + HOUR / 2);
    return {
      todayMg,
      inSystemMg: Math.round(mgInSystem(entries, current)),
      // Bedtime already passed: report what's in the system now instead.
      atBedtimeMg: Math.round(mgInSystem(entries, Math.max(bedtime, current))),
      wake,
      bedtime,
      curve: caffeineCurve(entries, wake, end),
    };
  }, [entries, todayMg, wakeMinutes, bedtimeMinutes, now]);
}
