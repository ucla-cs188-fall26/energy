import { useEffect, useRef } from "react";

import { useAuth } from "@/hooks/useAuth";
import { completePreferences, ProfilePreferences, saveProfile } from "@/services/api";
import { OnboardingAnswers, sleepWindowMinutes, toApiTime, useOnboardingStore } from "./store";

export function toProfilePreferences(a: OnboardingAnswers): ProfilePreferences {
  return {
    display_name: a.firstName,
    usual_bedtime: toApiTime(a.bedtimeMinutes),
    usual_wake_time: toApiTime(a.wakeMinutes),
    sleep_goal_minutes: sleepWindowMinutes(a.bedtimeMinutes, a.wakeMinutes),
    caffeine_frequency: a.caffeineFrequency,
    caffeine_sensitivity: a.sensitivity,
    selected_side_effects: a.sideEffects ?? [],
    sex: a.sex,
    age_years: a.ageYears,
    weight_kg: a.weightKg,
    height_cm: a.heightCm,
    measurement_units: a.units,
  };
}

/** Matches the completed_preferences_has_required_data constraint (migration 03). */
function hasRequiredAnswers(p: ProfilePreferences) {
  return !!(p.display_name && p.usual_bedtime && p.usual_wake_time && p.sleep_goal_minutes
    && p.caffeine_frequency && p.caffeine_sensitivity);
}

/**
 * After signup, saves the onboarding answers to the user's profile the first
 * time a session exists. That may be right away, or only after the user
 * confirms their email and signs in. If the API is unreachable, the answers
 * stay on the device and saving is retried on the next launch or sign-in.
 */
export function useSyncOnboardingProfile() {
  const { session } = useAuth();
  const pending = useOnboardingStore((s) => s.pendingSync);
  const signupEmail = useOnboardingStore((s) => s.signupEmail);
  const running = useRef(false);

  useEffect(() => {
    if (!session || !pending || running.current) return;
    // Never apply one person's answers to a different account on a shared device.
    if (session.user.email?.toLowerCase() !== signupEmail?.toLowerCase()) return;
    running.current = true;
    void (async () => {
      try {
        const preferences = toProfilePreferences(useOnboardingStore.getState());
        await saveProfile(preferences);
        if (hasRequiredAnswers(preferences)) await completePreferences();
        useOnboardingStore.getState().reset();
      } catch (cause) {
        console.warn("Onboarding profile not saved yet; will retry.", cause);
      } finally {
        running.current = false;
      }
    })();
  }, [session, pending, signupEmail]);
}
