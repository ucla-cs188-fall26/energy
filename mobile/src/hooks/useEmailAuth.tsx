import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { updatePassword } from "@/services/auth";
import { isAuthCallback, processAuthCallback, RECOVERY_STORAGE_KEY } from "@/services/auth-links";

type LinkState = { ready: boolean; processing: boolean; recovery: boolean; error: string | null; success: boolean; resultId: number };
type EmailAuth = LinkState & { finishRecovery: (password: string) => Promise<void> };
const EmailAuthContext = createContext<EmailAuth | null>(null);

export function EmailAuthProvider({ children }: PropsWithChildren) {
  const { session, loading, refreshSessionState } = useAuth();
  const refresh = useRef(refreshSessionState);
  refresh.current = refreshSessionState;
  const [state, setState] = useState<LinkState>({ ready: false, processing: false, recovery: false, error: null, success: false, resultId: 0 });

  useEffect(() => {
    let active = true;
    let incomingLink = false;
    let queue = Promise.resolve();
    let pendingUrl: string | null = null;
    let generation = 0;
    const handle = (url: string | null) => {
      if (!url || !isAuthCallback(url) || url === pendingUrl) return queue;
      pendingUrl = url; // Ignore simultaneous duplicate OS delivery.
      incomingLink = true;
      const current = ++generation;
      setState((s) => ({ ...s, processing: true, error: null, success: false }));
      queue = queue.then(async () => {
        try {
          const kind = await processAuthCallback(url);
          if (active) setState((s) => ({ ...s, recovery: kind === "recovery" }));
          // Persist the recovery gate before exposing the verified session to navigation.
          if (kind === "recovery") await AsyncStorage.setItem(RECOVERY_STORAGE_KEY, "true");
          else await AsyncStorage.removeItem(RECOVERY_STORAGE_KEY);
          await refresh.current();
          if (active && current === generation) setState({ ready: true, processing: false, recovery: kind === "recovery", error: null, success: true, resultId: current });
        } catch {
          if (active && current === generation) setState((s) => ({ ...s, ready: true, processing: false, success: false, resultId: current,
            error: "This link is invalid, expired, or already used. Request a new email and open it on the device where you requested it." }));
        } finally {
          if (current === generation) pendingUrl = null;
        }
      });
      return queue;
    };
    const subscription = Linking.addEventListener("url", ({ url }) => { void handle(url); });
    void (async () => {
      try {
        const [url, recovery] = await Promise.all([
          Linking.getInitialURL(), AsyncStorage.getItem(RECOVERY_STORAGE_KEY),
        ]);
        if (!incomingLink) await handle(url);
        else await queue;
        if (active && !incomingLink) setState((s) => ({ ...s, ready: true, recovery: recovery === "true" }));
      } catch {
        if (active) setState((s) => ({ ...s, ready: true, resultId: ++generation, error: "Unable to open the email link. Please try again." }));
      }
    })();
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (state.ready && !state.processing && !loading && !session && state.recovery) {
      setState((s) => ({ ...s, recovery: false }));
      void AsyncStorage.removeItem(RECOVERY_STORAGE_KEY).catch(() => {});
    }
  }, [loading, session, state.ready, state.processing, state.recovery]);

  const finishRecovery = async (password: string) => {
    if (!session || !state.recovery) throw new Error("Open a valid password-reset email first.");
    await updatePassword(password);
    await AsyncStorage.removeItem(RECOVERY_STORAGE_KEY);
    setState((s) => ({ ...s, recovery: false }));
  };
  return <EmailAuthContext.Provider value={{ ...state, finishRecovery }}>{children}</EmailAuthContext.Provider>;
}

export function useEmailAuth() {
  const value = useContext(EmailAuthContext);
  if (!value) throw new Error("useEmailAuth must be used within EmailAuthProvider");
  return value;
}
