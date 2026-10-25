/**
 * Pagar login demo (Fase 2) — fungsi murni, menerima env eksplisit agar
 * dapat diuji tanpa memuat stack Better Auth/DB (pola yang sama dengan
 * `origins.ts`).
 *
 * Matriks konfigurasi (satu-satunya sumber kebenaran untuk quick-login
 * DAN demo-status — keduanya harus memakai fungsi ini, bukan logika
 * duplikat):
 *
 * | Lingkungan | DEMO_LOGIN | DEMO_LOGIN_PUBLIC | quick-login |
 * |---|---|---|---|
 * | Lokal/dev (`NODE_ENV` bukan production, `APP_ENV` bukan production/staging) | apa pun | apa pun | HIDUP (kenyamanan dev) |
 * | Demo publik (server demo saja, BUKAN produksi sungguhan) | `enabled` | `true` | HIDUP |
 * | Produksi sungguhan (`NODE_ENV=production` atau `APP_ENV=production/staging`) | `enabled` saja, tanpa flag publik | — | MATI (404) |
 * | Produksi sungguhan | kosong/false | apa pun | MATI (404) |
 * | Staging tanpa flag publik | apa pun | — | MATI (404) |
 *
 * KENAPA staging ikut dipagari: konsisten dengan `AUTH_DEV_BYPASS` di
 * `resolve.ts` (pagar keras kedua), karena di staging matriks peran harus
 * diuji murni tanpa akun demo yang membocorkan hak.
 *
 * `DEMO_LOGIN_PUBLIC` BUKAN pengganti `DEMO_LOGIN`: keduanya harus aktif
 * bersamaan untuk demo di lingkungan production-like. Flag ini tidak aktif
 * secara default (kosong di `.env.example`, tidak diset di `docker-compose.yml`),
 * dan hanya boleh diset pada deployment yang memang server demo publik.
 *
 * Sandi demo TIDAK diubah di sini — ia sengaja publik & statis di
 * `demo-users.ts`; yang dijaga adalah pagar lingkungannya, bukan rahasianya.
 */

export interface DemoLoginEnv {
  NODE_ENV?: string;
  APP_ENV?: string;
  DEMO_LOGIN?: string;
  DEMO_LOGIN_PUBLIC?: string;
  [key: string]: string | undefined;
}

/** Apakah deployment ini server demo publik yang disengaja (bukan produksi)? */
export function isDemoPublic(env: DemoLoginEnv): boolean {
  return env.DEMO_LOGIN === "enabled" && env.DEMO_LOGIN_PUBLIC === "true";
}

/** Apakah lingkungan ini production-like (production atau staging)? */
export function isProductionLike(env: DemoLoginEnv): boolean {
  if (env.NODE_ENV === "production") return true;
  const appEnv = env.APP_ENV?.toLowerCase();
  return appEnv === "production" || appEnv === "staging";
}

/**
 * Apakah login demo diizinkan di lingkungan ini?
 *
 * Pagar ganda, konsisten dengan `AUTH_DEV_BYPASS`:
 *  1. Lingkungan production-like → mati, KECUALI demo publik eksplisit.
 *  2. Lingkungan non-production-like → hidup (kenyamanan dev, seperti dulu).
 */
export function demoLoginAllowed(env: DemoLoginEnv = process.env): boolean {
  if (isProductionLike(env)) return isDemoPublic(env);
  return true;
}
