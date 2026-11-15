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
    throw new Error(response.status === 401 ? "Session expired. Please sign in again." : failure);
  }
  return response.json();
}

export function getCurrentUser(): Promise<CurrentUser> {
  return request("/users/me", {}, "Unable to load your account");
}

export function saveProfile(preferences: ProfilePreferences) {
  return request("/users/me/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preferences),
  }, "Unable to save your profile");
}

export function completePreferences() {
  return request("/users/me/preferences/complete", { method: "POST" }, "Unable to finish setting up your profile");
}
