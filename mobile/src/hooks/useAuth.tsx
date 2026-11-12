import { Session } from "@supabase/supabase-js";
import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import { supabase } from "@/services/supabase";
import * as auth from "@/services/auth";

type AuthState = { session: Session | null; loading: boolean; error: string | null };
type AuthContextValue = AuthState & {
  signIn: typeof auth.signIn;
  signUp: typeof auth.signUp;
  signOut: typeof auth.signOut;
  refreshSessionState: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true, error: null });
  const sessionRevision = useRef(0);

  useEffect(() => {
    let active = true;
    const initialRevision = sessionRevision.current;
    // INITIAL_SESSION restores persisted credentials; subsequent events include refresh and logout.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" && sessionRevision.current !== initialRevision) return;
      if (event !== "INITIAL_SESSION") sessionRevision.current += 1;
      if (active) setState({ session, loading: false, error: null });
    });
    // Also surface storage/initialization errors instead of leaving a loading screen forever.
    void supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (active && sessionRevision.current === initialRevision) {
        setState({ session: error ? null : session, loading: false, error: error?.message ?? null });
      }
    }).catch(() => {
      if (active && sessionRevision.current === initialRevision) setState({ session: null, loading: false, error: "Unable to restore your session" });
    });

    const refresh = (status: string | null | undefined) => {
      if (status === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    if (Platform.OS !== "web") refresh(AppState.currentState);
    const listener = Platform.OS !== "web" ? AppState.addEventListener("change", refresh) : null;
    return () => {
      active = false;
      subscription.unsubscribe();
      listener?.remove();
      if (Platform.OS !== "web") supabase.auth.stopAutoRefresh();
    };
  }, []);

  // Update the route guard from the completed operation as well as SDK events.
  // A successful login must not depend on a later event or an app reload.
  const signIn: typeof auth.signIn = async (email, password) => {
    const data = await auth.signIn(email, password);
    if (!data.session) throw new Error("Sign-in did not create a session. Please try again.");
    sessionRevision.current += 1;
    setState({ session: data.session, loading: false, error: null });
    return data;
  };
  const signUp: typeof auth.signUp = async (email, password) => {
    const data = await auth.signUp(email, password);
    if (data.session) {
      sessionRevision.current += 1;
      setState({ session: data.session, loading: false, error: null });
    }
    return data;
  };
  const signOut: typeof auth.signOut = async () => {
    await auth.signOut();
    sessionRevision.current += 1;
    setState({ session: null, loading: false, error: null });
  };

  const refreshSessionState = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) throw new Error("Unable to restore the verified session. Please sign in again.");
    sessionRevision.current += 1;
    setState({ session, loading: false, error: null });
  };

  return <AuthContext.Provider value={{ ...state, signIn, signUp, signOut, refreshSessionState }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
