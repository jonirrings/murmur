import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    magicLinkClient(),
    passkeyClient(),
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.dispatchEvent(new CustomEvent("auth:two-factor-required"));
      },
    }),
  ],
});

export const { signIn, signOut, signUp, useSession } = authClient;
