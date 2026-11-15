import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { useOnboardingStore } from "@/features/onboarding/store";
import { useAuth } from "@/hooks/useAuth";
import { getProfile, ProfilePreferences, saveProfile, UserProfile } from "@/services/api";

type ProfileState = { profile: UserProfile | null; setProfile: (profile: UserProfile | null) => void };

// Cached on the device so the app shows the user's schedule and name offline
// and before the backend responds.
export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({ profile: null, setProfile: (profile) => set({ profile }) }),
    {
      name: "user-profile",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ profile }) => ({ profile }),
    },
  ),
);

/** Refreshes the cached profile from the backend. Failures keep the cache. */
export async function refreshProfile() {
  try {
    const profile = await getProfile();
    if (profile) useProfileStore.getState().setProfile(profile);
  } catch {
    // Backend unreachable or session expired; keep showing the cached profile.
  }
}

/**
 * Saves changed profile fields through the backend and updates the cache.
 * Throws if the backend can't be reached, so the screen can show an error.
 */
export async function updateProfile(changes: ProfilePreferences) {
  const profile = await saveProfile(changes);
  useProfileStore.getState().setProfile(profile);
  return profile;
}

/** The cached profile, if it belongs to the signed-in user. */
export function useMyProfile() {
  const { session } = useAuth();
  const cached = useProfileStore((s) => s.profile);
  return cached && cached.id === session?.user.id ? cached : null;
}

/** "23:00:00" -> 1380 */
export function clockMinutes(value: string | null | undefined) {
  const match = value ? /^(\d{1,2}):(\d{2})/.exec(value) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export type ProfileSettings = {
  name: string | null;
  firstName: string | null;
  bedtimeMinutes: number;
  wakeMinutes: number;
};

/**
 * The signed-in user's schedule and name. Uses the saved profile when it
 * belongs to this user; otherwise falls back to onboarding answers still on
 * the device (before they've synced), which default to 11 PM / 7 AM.
 */
export function useProfileSettings(): ProfileSettings {
  const profile = useMyProfile();
  const onboarding = useOnboardingStore();

  const name = profile?.display_name ?? (onboarding.pendingSync ? onboarding.fullName : null);
  return {
    name,
    firstName: name ? name.split(" ")[0] : null,
    bedtimeMinutes: clockMinutes(profile?.usual_bedtime) ?? onboarding.bedtimeMinutes,
    wakeMinutes: clockMinutes(profile?.usual_wake_time) ?? onboarding.wakeMinutes,
  };
}
