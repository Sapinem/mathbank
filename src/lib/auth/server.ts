import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { apiKey } from "@better-auth/api-key";
import { db } from "@/lib/db";
import {
  authUser,
  authSession,
  authAccount,
  authVerification,
  apiKey as apiKeyTable,
} from "@/lib/db/schema/auth";

/**
 * Better Auth — MathBank (dua kelas kredensial, satu sistem):
 *  - session cookie → manusia (UI)
 *  - API key plugin → agen/mesin (MCP, ingest)
 *
 * Peran TIDAK disimpan di `user` — pakai tabel `user_roles` (multi-role, L1).
 */

const authSecret = process.env.BETTER_AUTH_SECRET;
if (process.env.NODE_ENV === "production" && !authSecret) {
  throw new Error(
    "FATAL: BETTER_AUTH_SECRET wajib di produksi. Buat: openssl rand -hex 32",
  );
}

export const auth = betterAuth({
  appName: "MathBank",
  secret: authSecret,
  ...(process.env.BETTER_AUTH_URL ? { baseURL: process.env.BETTER_AUTH_URL } : {}),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
      apikey: apiKeyTable,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  user: {
    additionalFields: {
      mustChangePassword: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: true,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 hari
    updateAge: 60 * 60 * 24, // 1 hari
  },
  plugins: [
    apiKey({
      enableMetadata: true,
      keyExpiration: { defaultExpiresIn: 60 * 60 * 24 * 90 }, // 90 hari
      rateLimit: { enabled: true, timeWindow: 60 * 1000, maxRequests: 120 },
      permissions: {
        defaultPermissions: {
          question: ["create", "read"],
          asset: ["create", "read"],
        },
      },
    }),
  ],
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
  ],
});
