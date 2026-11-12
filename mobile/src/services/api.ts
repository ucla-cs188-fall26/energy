import { supabase } from "./supabase";

export type CurrentUser = { id: string; email: string };

export async function getCurrentUser(): Promise<CurrentUser> {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) throw new Error("Set EXPO_PUBLIC_API_URL in mobile/.env");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session) throw new Error("Please sign in first");
  const response = await fetch(`${url.replace(/\/$/, "")}/users/me`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!response.ok) {
    throw new Error(response.status === 401 ? "Session expired. Please sign in again." : "Unable to load your account");
  }
  return response.json();
}
