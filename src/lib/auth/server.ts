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
  rateLimit as rateLimitTable,
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
      rateLimit: rateLimitTable,
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
  trustedOrigins: [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    // Domain utama (produksi) — lihat APP_URL / .env.example.
    ...(process.env.APP_URL ? [process.env.APP_URL] : []),
    "https://b.iyo.my.id",
    // Akses dev via LAN (sesuaikan/tambah lewat ALLOWED_DEV_ORIGINS bila perlu).
    ...(process.env.ALLOWED_DEV_ORIGINS ?? "192.168.18.100")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean)
      .flatMap((h) => [`http://${h}:3001`, `http://${h}:3000`]),
  ],
});
