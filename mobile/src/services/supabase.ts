import "react-native-url-polyfill/auto";
import "./pkce-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key || !key.startsWith("sb_publishable_")) {
  throw new Error("Set EXPO_PUBLIC_SUPABASE_URL and a Supabase publishable key in mobile/.env");
}

export const supabase = createClient(url, key, {
  auth: {
    ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});

