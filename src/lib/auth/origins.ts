/**
 * Logika origin & gerbang lingkungan auth (M14 — ekstraksi dari `server.ts`).
 *
 * Fungsi **murni** (menerima `env` eksplisit) agar dapat diuji tanpa memuat
 * seluruh stack Better Auth/DB. `server.ts` memanggilnya dengan `process.env`.
 */

/** Lingkungan yang dianggap "produksi" untuk memagari origin dev. */
export interface EnvLike {
  NODE_ENV?: string;
  APP_ENV?: string;
  APP_URL?: string;
  ALLOWED_DEV_ORIGINS?: string;
  [key: string]: string | undefined;
}

/**
 * Apakah runtime ini produksi (untuk memagari origin dev).
 * Produksi bila `NODE_ENV=production` ATAU `APP_ENV` `production`/`staging`.
 */
export function isProductionRuntime(env: EnvLike): boolean {
  if (env.NODE_ENV === "production") return true;
  const appEnv = env.APP_ENV?.toLowerCase();
  return appEnv === "production" || appEnv === "staging";
}

/** Domain produksi yang **selalu** dipercaya (independen lingkungan). */
export const PRODUCTION_ORIGINS = ["https://b.iyo.my.id"];

/** Origin dev lokal baku (hanya dipakai di non-produksi). */
export const LOCAL_DEV_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

/**
 * Bangun daftar `trustedOrigins` (CORS/CSRF).
 *
 * - Produksi: `APP_URL` (bila ada) + domain resmi SAJA — origin dev **tidak**
 *   didaftarkan, agar permukaan CORS/CSRF tak melebar.
 * - Non-produksi: tambah localhost + host LAN dari `ALLOWED_DEV_ORIGINS`
 *   (port 3000 & 3001).
 */
export function buildTrustedOrigins(env: EnvLike): string[] {
  const base = [
    ...(env.APP_URL ? [env.APP_URL] : []),
    ...PRODUCTION_ORIGINS,
  ];
  if (isProductionRuntime(env)) return base;

  const lanHosts = (env.ALLOWED_DEV_ORIGINS ?? "192.168.18.100")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean)
    .flatMap((h) => [`http://${h}:3001`, `http://${h}:3000`]);

  return [...base, ...LOCAL_DEV_ORIGINS, ...lanHosts];
}

/**
 * Nilai `secret` Better Auth; **wajib** di produksi (gagal-cepat bila kosong).
 * @throws Error bila produksi tanpa secret.
 */
export function resolveAuthSecret(env: EnvLike): string | undefined {
  const secret = env.BETTER_AUTH_SECRET;
  if (env.NODE_ENV === "production" && !secret) {
    throw new Error(
      "FATAL: BETTER_AUTH_SECRET wajib di produksi. Buat: openssl rand -hex 32",
    );
  }
  return secret;
}
