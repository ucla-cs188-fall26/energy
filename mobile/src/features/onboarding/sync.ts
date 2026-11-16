import { useEffect } from "react";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/services/supabase";
import { useProfileStore } from "@/features/profile/store";
import { completePreferences, ProfilePreferences, saveProfile } from "@/services/api";
import { OnboardingAnswers, sleepWindowMinutes, toApiTime, useOnboardingStore } from "./store";

export function toProfilePreferences(a: OnboardingAnswers): ProfilePreferences {
  return {
    display_name: a.fullName,
    usual_bedtime: toApiTime(a.bedtimeMinutes),
    usual_wake_time: toApiTime(a.wakeMinutes),
    sleep_goal_minutes: sleepWindowMinutes(a.bedtimeMinutes, a.wakeMinutes),
    caffeine_frequency: a.caffeineFrequency,
    caffeine_sensitivity: a.sensitivity,
    selected_side_effects: a.sideEffects ?? [],
    sex: a.sex, age_years: a.ageYears, weight_kg: a.weightKg,
    height_cm: a.heightCm, measurement_units: a.units,
  };
}

/** Matches the completed_preferences_has_required_data constraint (migration 03). */
function hasRequiredAnswers(p: ProfilePreferences) {
  return !!(p.display_name && p.usual_bedtime && p.usual_wake_time && p.sleep_goal_minutes
    && p.caffeine_frequency && p.caffeine_sensitivity);
}
let pending: { user: string; promise: Promise<void> } | null = null;

/** Retryable, account-bound sync. Never copy another account's local answers. */
export function syncPendingProfile(user: { id: string; email?: string }) {
  if (pending?.user === user.id) return pending.promise;
  const answers = useOnboardingStore.getState();
  if (!answers.pendingSync || !user.email || user.email.toLowerCase() !== answers.signupEmail?.toLowerCase()) return Promise.resolve();
  const promise = (async () => {
    const preferences = toProfilePreferences(answers);
    let profile = await saveProfile(preferences, user.id);
    if (hasRequiredAnswers(preferences)) profile = await completePreferences(user.id);
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user.id !== user.id) return;
    useProfileStore.getState().setProfile(profile);
    if (useOnboardingStore.getState() === answers) useOnboardingStore.getState().reset();
  })().finally(() => { if (pending?.user === user.id) pending = null; });
  pending = { user: user.id, promise };
  return promise;
}

export function useSyncOnboardingProfile(enabled = true) {
  const { session } = useAuth();
  const pending = useOnboardingStore(s => s.pendingSync);
  const signupEmail = useOnboardingStore(s => s.signupEmail);
  useEffect(() => {
    if (enabled && session && pending) void syncPendingProfile(session.user).catch(() => {
      // Answers remain available; Account provides a visible retry action.
    });
  }, [enabled, session?.user.id, pending, signupEmail]);
}
