import { supabase } from "./supabase";

export type CurrentUser = { id: string; email: string };

/** Fields accepted by PUT /users/me/profile (backend ProfilePreferences). Omitted fields are left unchanged. */
export type ProfilePreferences = Partial<{
  display_name: string | null;
  usual_bedtime: string | null;
  usual_wake_time: string | null;
  sleep_goal_minutes: number | null;
  caffeine_frequency: string | null;
  caffeine_sensitivity: string | null;
  selected_side_effects: string[];
  sex: string | null;
  age_years: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  measurement_units: string | null;
}>;

/** Profile as returned by GET/PUT /users/me/profile. Times are "HH:MM:SS". */
export type UserProfile = Required<ProfilePreferences> & {
  id: string;
  preferences_completed: boolean;
};

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function request<T>(path: string, init: RequestInit, failure: string): Promise<T> {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) throw new Error("Set EXPO_PUBLIC_API_URL in mobile/.env");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) throw new Error("Please sign in first");
  const response = await fetch(`${url.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) {
    throw new ApiError(response.status === 401 ? "Session expired. Please sign in again." : failure, response.status);
  }
  return response.json();
}

export function getCurrentUser(): Promise<CurrentUser> {
  return request("/users/me", {}, "Unable to load your account");
}

/** The signed-in user's profile, or null if they haven't saved one yet. */
export async function getProfile(): Promise<UserProfile | null> {
  try {
    return await request<UserProfile>("/users/me/profile", {}, "Unable to load your profile");
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) return null;
    throw cause;
  }
}

export function saveProfile(preferences: ProfilePreferences) {
  return request<UserProfile>("/users/me/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preferences),
  }, "Unable to save your profile");
}

export function completePreferences() {
  return request<UserProfile>("/users/me/preferences/complete", { method: "POST" }, "Unable to finish setting up your profile");
}
