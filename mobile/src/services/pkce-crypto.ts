import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

// Supabase uses WebCrypto for PKCE. Supply its two required operations on native
// runtimes so it never falls back to Math.random or a plain-text challenge.
if (Platform.OS !== "web" && !globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      getRandomValues: Crypto.getRandomValues,
      subtle: {
        digest: (algorithm: string, data: BufferSource) => {
          if (algorithm !== "SHA-256") throw new Error("Unsupported PKCE digest");
          return Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data);
        },
      },
    },
  });
}
