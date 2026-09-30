/**
 * Kebijakan kata sandi (M13 — S5).
 *
 * Fungsi **murni** (tanpa I/O) agar mudah diuji & dipakai di UI + server.
 * Diterapkan di:
 *  - Better Auth `emailAndPassword` (validasi saat daftar/ganti sandi),
 *  - `change-password` UI (umpan balik real-time),
 *  - skrip seed (mencegah sandi demo lemah di produksi).
 *
 * Aturan (kebijakan "kuat tapi praktis"):
 *  - Panjang minimal **12** karakter (NIST SP 800-63B menekankan panjang).
 *  - Wajib mengandung **huruf** dan **angka**.
 *  - Menolak sandi yang umum/lemah (daftar blocklist kecil & huruf berulang).
 *  - **TIDAK** mewajibkan simbol (mengurangi friksi tanpa menambah keamanan nyata).
 */

/** Panjang minimal sandi. */
export const MIN_PASSWORD_LENGTH = 12;
/** Panjang maksimal (hindari DoS hashing). */
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Daftar sandi lemah yang jelas dilarang (kecil & tak lengkap — ini lapis tambahan,
 * bukan pengganti panjang/kompleksitas). Huruf kecil semua untuk pencocokan.
 */
const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "passw0rd",
  "123456",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty",
  "qwerty123",
  "admin",
  "admin123",
  "administrator",
  "mathbank",
  "mathbank123",
  "letmein",
  "welcome",
  "welcome1",
  "iloveyou",
  "abc123",
  "password1",
  "p@ssw0rd",
  "changeme",
  "secret",
  "rahasia",
  "rahasia123",
  "kata sandi",
  "katarahasia",
]);

export interface PasswordCheck {
  /** True bila sandi memenuhi semua aturan. */
  ok: boolean;
  /** Daftar alasan penolakan (kosong bila `ok`). */
  errors: string[];
  /** Kekuatan kasar 0–4 (untuk indikator UI). */
  score: 0 | 1 | 2 | 3 | 4;
}

/**
 * Periksa sandi terhadap kebijakan. Kembalikan alasan penolakan + skor kekuatan.
 */
export function checkPassword(password: string): PasswordCheck {
  const errors: string[] = [];
  const pwd = password ?? "";

  if (pwd.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter.`);
  }
  if (pwd.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Kata sandi maksimal ${MAX_PASSWORD_LENGTH} karakter.`);
  }
  if (!/[A-Za-z]/.test(pwd)) {
    errors.push("Harus mengandung huruf.");
  }
  if (!/[0-9]/.test(pwd)) {
    errors.push("Harus mengandung angka.");
  }
  if (COMMON_PASSWORDS.has(pwd.toLowerCase().trim())) {
    errors.push("Kata sandi terlalu umum — pilih yang lain.");
  }
  // Semua karakter sama (mis. "aaaaaaaaaaaa") → tolak.
  if (/^(.)\1+$/.test(pwd)) {
    errors.push("Kata sandi tidak boleh karakter berulang semua.");
  }

  return { ok: errors.length === 0, errors, score: strengthOf(pwd) };
}

/** Skor kekuatan kasar (0–4) untuk indikator UI. Murni heuristik. */
export function strengthOf(password: string): 0 | 1 | 2 | 3 | 4 {
  const pwd = password ?? "";
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= MIN_PASSWORD_LENGTH) score++;
  if (pwd.length >= 16) score++;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(pwd)).length;
  if (classes >= 3) score++;
  if (classes >= 4 && pwd.length >= 14) score++;
  // Penalti: sandi umum → paksa rendah.
  if (COMMON_PASSWORDS.has(pwd.toLowerCase().trim())) return 1;
  return Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
}

/** Apakah sandi memenuhi kebijakan (boolean ringkas). */
export function isStrongPassword(password: string): boolean {
  return checkPassword(password).ok;
}
