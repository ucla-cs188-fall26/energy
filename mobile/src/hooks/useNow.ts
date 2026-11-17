import { useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * Current time in ms, re-rendering every `intervalMs`, as soon as the app
 * returns to the foreground, and right at local midnight, so anything that
 * depends on "today" switches over on time.
 */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(Date.now);
  // Re-arm the midnight timer once each new day starts.
  const day = new Date(now).toDateString();
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, intervalMs);
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 50);
    const atMidnight = setTimeout(tick, midnight.getTime() - Date.now());
    const sub = AppState.addEventListener("change", (state) => { if (state === "active") tick(); });
    return () => { clearInterval(id); clearTimeout(atMidnight); sub.remove(); };
  }, [intervalMs, day]);
  return now;
}
