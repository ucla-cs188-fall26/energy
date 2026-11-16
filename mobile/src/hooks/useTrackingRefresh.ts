import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useTrackingSync } from "@/services/tracking-sync";

/** Refresh on tab focus, foreground, and while a tracking screen remains open. */
export function useTrackingRefresh() {
  const refresh = useTrackingSync(s => s.refresh);
  useFocusEffect(useCallback(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(timer);
  }, [refresh]));
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => { if (state === "active") void refresh(); });
    return () => listener.remove();
  }, [refresh]);
}
