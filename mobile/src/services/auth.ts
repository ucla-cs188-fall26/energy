import { supabase } from "./supabase";
import { AUTH_CALLBACK_URL, RECOVERY_STORAGE_KEY } from "./auth-links";
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(), password, options: { emailRedirectTo: AUTH_CALLBACK_URL },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  await AsyncStorage.removeItem(RECOVERY_STORAGE_KEY);
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: AUTH_CALLBACK_URL,
  });
  if (error) throw new Error("Unable to send the reset email. Please try again later.");
}

export async function resendVerification(email: string) {
  const { error } = await supabase.auth.resend({
    type: "signup", email: email.trim(), options: { emailRedirectTo: AUTH_CALLBACK_URL },
  });
  if (error) throw new Error("Unable to resend verification. Please try again later.");
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error("Unable to update your password. Check the password requirements or request a new reset link.");
}
