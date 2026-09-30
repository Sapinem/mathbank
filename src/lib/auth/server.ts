import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { apiKey } from "@better-auth/api-key";
import { db } from "@/lib/db";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import { resolveAuthSecret, buildTrustedOrigins } from "@/lib/auth/origins";
import {
  authUser,
  authSession,
  authAccount,
  authVerification,
  apiKey as apiKeyTable,
  rateLimit as rateLimitTable,
} from "@/lib/db/schema/auth";

/**
 * Better Auth — MathBank (dua kelas kredensial, satu sistem):
 *  - session cookie → manusia (UI)
 *  - API key plugin → agen/mesin (MCP, ingest)
 *
 * Peran TIDAK disimpan di `user` — pakai tabel `user_roles` (multi-role, L1).
 * Logika gerbang lingkungan (produksi/dev) ada di `origins.ts` (murni, teruji).
 */

const authSecret = resolveAuthSecret(process.env);

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
      rateLimit: rateLimitTable,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    // S5 (M13): panjang minimal 12 (best practice Better Auth / NIST SP 800-63B).
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
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
  /**
   * Rate limit — anti brute-force login.
   *
   * - Aktif otomatis bila `NODE_ENV=production`; rule bawaan Better Auth:
   *   `/sign-in*` 3 req/10 s, `/request-password-reset` 3 req/60 s, umum 100 req/60 s.
   *   Kita **tidak** menimpa rule bawaan (tidak tambal sulam).
   * - `storage: "database"` → counter persisten & dibagi antar-proses (default
   *   `memory` hilang saat restart & tak cocok multi-instance/ serverless).
   *   Tabel `rate_limit` (lihat `db/schema/auth.ts`).
   * - IP asli klien di balik Cloudflare ada di header `cf-connecting-ip`
   *   (header default `x-forwarded-for` tak dapat dipercaya di sini).
   */
  rateLimit: {
    storage: "database",
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["cf-connecting-ip"],
    },
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
  trustedOrigins: buildTrustedOrigins(process.env),
});
