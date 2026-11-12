import { supabase } from "./supabase";

export const AUTH_CALLBACK_URL = "energyapp://auth/callback";
export const RECOVERY_STORAGE_KEY = "energy.auth.passwordRecovery";
export const AUTHENTICATED_DESTINATION = "/(tabs)" as const;
// Future preferences routing can replace this destination after loading the profile.
export type AuthLinkKind = "verification" | "recovery";

const inFlight = new Map<string, Promise<AuthLinkKind>>();
const consumed = new Set<string>();
const invalidLinkMessage = "This email link is invalid, expired, or already used. Request a new email and open it on the device where you requested it.";

export function isAuthCallback(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "energyapp:" || parsed.username || parsed.password || parsed.port) return false;
    return (parsed.hostname === "auth" && /^\/callback\/?$/.test(parsed.pathname)) ||
      (!parsed.hostname && /^\/auth\/callback\/?$/.test(parsed.pathname));
  } catch {
    return false;
  }
}

export async function processAuthCallback(rawUrl: string): Promise<AuthLinkKind> {
  if (!isAuthCallback(rawUrl)) throw new Error(invalidLinkMessage);
  const url = new URL(rawUrl);
  const params = url.searchParams;
  // Accept only PKCE codes. Never import bearer tokens from arbitrary deep links.
  if (url.hash || params.has("error") || params.has("error_code") ||
      params.has("access_token") || params.has("refresh_token") ||
      params.getAll("code").length !== 1 || !params.get("code")) {
    throw new Error(invalidLinkMessage);
  }
  const code = params.get("code")!;
  if (code.length > 2048 || consumed.has(code)) throw new Error(invalidLinkMessage);
  const existing = inFlight.get(code);
  if (existing) return existing;
  const operation = (async (): Promise<AuthLinkKind> => {
    let recovery = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") recovery = true;
    });
    try {
      const flowId = params.get("sb_flow_id");
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        code, flowId ? { flowId } : undefined,
      );
      if (error || !data.session) throw new Error(invalidLinkMessage);
      consumed.add(code);
      if (consumed.size > 20) consumed.delete(consumed.values().next().value!);
      // Supabase derives this event from its stored verifier, not a query flag.
      return recovery ? "recovery" : "verification";
    } catch {
      // Do not expose SDK errors, callback URLs, codes, or tokens in UI/logs.
      throw new Error(invalidLinkMessage);
    } finally {
      subscription.unsubscribe();
    }
  })();
  inFlight.set(code, operation);
  try { return await operation; }
  finally { inFlight.delete(code); }
}
