import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Values match the user_profiles check constraints (database/migrations/03).
export type CaffeineFrequency = "daily" | "few_times_week" | "rarely" | "never";
export type SideEffect =
  | "jitters" | "anxiety" | "headaches" | "sleep_disruption" | "stomach_upset" | "energy_crash";
export type CaffeineSensitivity = "low" | "medium" | "high";
export type Sex = "female" | "male";
export type Units = "metric" | "imperial";

export type OnboardingAnswers = {
  caffeineFrequency: CaffeineFrequency | null;
  /** null = unanswered; [] = "None of these". */
  sideEffects: SideEffect[] | null;
  /** Minutes after midnight, local time. */
  bedtimeMinutes: number;
  wakeMinutes: number;
  sensitivity: CaffeineSensitivity;
  sex: Sex | null;
  units: Units;
  /** Body measurements are always stored metric; the UI converts for imperial. */
  ageYears: number | null;
  weightKg: number | null;
  heightCm: number | null;
  firstName: string | null;
  /** Set at account creation; the answers are only saved to this account's profile. */
  signupEmail: string | null;
  /** True from account creation until the answers are saved to the profile. */
  pendingSync: boolean;
};

type OnboardingState = OnboardingAnswers & {
  set: (patch: Partial<OnboardingAnswers>) => void;
  reset: () => void;
};

export const initialAnswers: OnboardingAnswers = {
  caffeineFrequency: null,
  sideEffects: null,
  bedtimeMinutes: 23 * 60,
  wakeMinutes: 7 * 60,
  sensitivity: "medium",
  sex: null,
  units: "metric",
  ageYears: null,
  weightKg: null,
  heightCm: null,
  firstName: null,
  signupEmail: null,
  pendingSync: false,
};

// Answers are collected before the account exists, and signup sends the user
// out to their email app to confirm. Persisting them on the device means they
// survive that round trip and can be saved to the profile after first sign-in.
export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialAnswers,
      set: (patch) => set(patch),
      reset: () => set(initialAnswers),
    }),
    {
      name: "onboarding-answers",
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ set: _set, reset: _reset, ...answers }) => answers,
      // v0 only stored caffeineFrequency; v1 also allowed sex "undisclosed", which was removed.
      migrate: (persisted) => {
        const answers = { ...initialAnswers, ...(persisted as Partial<OnboardingAnswers>) };
        if (answers.sex !== "female" && answers.sex !== "male") answers.sex = null;
        return answers;
      },
    },
  ),
);

export const SLEEP_STEP_MINUTES = 30;
const DAY = 24 * 60;

export const wrapMinutes = (m: number) => ((m % DAY) + DAY) % DAY;

export function formatClock(minutes: number) {
  const m = wrapMinutes(minutes);
  const h24 = Math.floor(m / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m % 60).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

/** "23:00" form for the API. */
export function toApiTime(minutes: number) {
  const m = wrapMinutes(minutes);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function sleepWindowMinutes(bedtime: number, wake: number) {
  return wrapMinutes(wake - bedtime) || DAY;
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Hours before bedtime to stop caffeine, by sensitivity. */
export const CAFFEINE_CUTOFF_HOURS: Record<CaffeineSensitivity, number> = { low: 6, medium: 8, high: 10 };

export function bmi(weightKg: number | null, heightCm: number | null) {
  if (!weightKg || !heightCm) return null;
  return weightKg / (heightCm / 100) ** 2;
}
