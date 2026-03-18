import Google from "next-auth/providers/google";
import type { AuthPlugin } from "../types";

export const googlePlugin: AuthPlugin = {
  id: "google",
  name: "Google",
  getProvider: () =>
    Google({
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET!,
    }),
};
