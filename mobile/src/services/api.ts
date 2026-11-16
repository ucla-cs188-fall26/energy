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

async function request<T>(path: string, init: RequestInit, failure: string, expectedUserId?: string): Promise<T> {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) throw new Error("Set EXPO_PUBLIC_API_URL in mobile/.env");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) throw new Error("Please sign in first");
  if (expectedUserId && session.user.id !== expectedUserId) throw new Error("Account changed. Please try again.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${url.replace(/\/$/, "")}${path}`, {
      ...init, signal: controller.signal,
      headers: { ...init.headers, Authorization: `Bearer ${session.access_token}` },
    });
    if (!response.ok) {
      const message = response.status === 401 ? "Session expired. Please sign in again."
        : response.status === 422 ? "Check the amounts, dates, and required fields, then try again."
        : response.status === 409 ? "This record changed or a session is already active. Refresh and try again."
        : response.status === 403 ? "Access denied. Check your account and database permissions."
        : failure;
      throw new ApiError(message, response.status);
    }
    if (response.status === 204) return undefined as T;
    return await response.json();
  } catch (cause) {
    if (controller.signal.aborted) throw new Error("Request timed out. Check your connection and try again.");
    throw cause;
  } finally { clearTimeout(timeout); }
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

export function saveProfile(preferences: ProfilePreferences, expectedUserId?: string) {
  return request<UserProfile>("/users/me/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preferences),
  }, "Unable to save your profile", expectedUserId);
}

export function completePreferences(expectedUserId?: string) {
  return request<UserProfile>("/users/me/preferences/complete", { method: "POST" }, "Unable to finish setting up your profile", expectedUserId);
}

export type Page<T> = { items: T[]; limit: number; offset: number; has_more: boolean };
export type SessionRecord = { id: string; user_id: string; started_at: string; ended_at: string | null;
  duration_seconds: number | null; elapsed_seconds: number; sleep_quality?: number | null; refreshed_rating?: number | null };
export type CaffeineRecord = { id: string; beverage_name: string; caffeine_mg: string | number;
  serving_size_ml: string | number; consumed_at: string; logging_method: "manual" | "preset" | "camera" };
export type BeveragePreset = { id: string; beverage_name: string; caffeine_mg: string | number; serving_size_ml: string | number };
export type EnergyObservation = { id: string; energy_rating: number; recorded_at: string; created_at: string };
export type EnergyPoint = { timestamp: string; score: number | null; caffeine_remaining_mg: number; status: "estimated" | "unavailable" | "sleeping" };
export type Prediction = EnergyPoint & { model_type: string; model_version: string; timezone: string;
  forecast: EnergyPoint[]; warnings: string[]; assumptions: string[]; data_quality: "limited" | "unavailable" };

export function localTimezone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
async function send<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  return request<T>(path, { method, ...(body === undefined ? {} : {
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }) }, "Unable to sync with EnergySync. Please try again.");
}
async function allPages<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  let more = true;
  while (more) {
    const page = await send<Page<T>>(`${path}?limit=100&offset=${items.length}`);
    items.push(...page.items);
    more = page.has_more && page.items.length > 0;
  }
  return items;
}
export const trackingApi = {
  sleepHistory: () => allPages<SessionRecord>("/sleep/sessions"),
  napHistory: () => allPages<SessionRecord>("/naps/sessions"),
  activeSleep: () => send<SessionRecord | null>("/sleep/sessions/active"),
  activeNap: () => send<SessionRecord | null>("/naps/sessions/active"),
  startSleep: () => send<SessionRecord>("/sleep/sessions/start", "POST", {}),
  stopSleep: (id: string) => send<SessionRecord>(`/sleep/sessions/${id}/stop`, "POST", {}),
  rateSleep: (id: string, rating: number) => send<SessionRecord>(`/sleep/sessions/${id}/quality`, "PUT", { sleep_quality: rating }),
  startNap: () => send<SessionRecord>("/naps/sessions/start", "POST", {}),
  stopNap: (id: string, rating?: number) => send<SessionRecord>(`/naps/sessions/${id}/stop`, "POST", { refreshed_rating: rating }),
  logNap: (started_at: string, ended_at: string, refreshed_rating?: number) => send<SessionRecord>("/naps/sessions/log", "POST", { started_at, ended_at, refreshed_rating }),
  rateNap: (id: string, rating: number) => send<SessionRecord>(`/naps/sessions/${id}/rating`, "PUT", { refreshed_rating: rating }),
  caffeineHistory: () => allPages<CaffeineRecord>("/caffeine/logs"),
  presets: () => send<BeveragePreset[]>("/caffeine/presets"),
  addCaffeine: (body: unknown) => send<CaffeineRecord>("/caffeine/logs", "POST", body),
  updateCaffeine: (id: string, body: unknown) => send<CaffeineRecord>(`/caffeine/logs/${id}`, "PUT", body),
  deleteCaffeine: (id: string) => send<void>(`/caffeine/logs/${id}`, "DELETE"),
  prediction: () => send<Prediction>(`/energy/predict?timezone=${encodeURIComponent(localTimezone())}`),
  energyHistory: () => allPages<EnergyObservation>("/energy/checkins"),
  checkin: (energy_rating: number) => send<EnergyObservation>("/energy/checkins", "POST", { energy_rating }),
};
