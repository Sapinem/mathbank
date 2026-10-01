/**
 * Generator `short_id` media — fungsi murni (L6).
 *
 * Dipakai sebagai kunci kanonik di shortcode `{{img:<shortId>}}`. Markdown soal
 * TIDAK menyimpan path storage; ia menyimpan 8 karakter ini, dan DB yang tahu
 * berkas mana yang dimaksud.
 *
 * Ruang: base62^8 = 218.340.105.584.896 (≈2,2×10^14).
 *   - 8 huruf dipilih (bukan 6) supaya peluang tabrakan tetap kecil walau aset
 *     tumbuh sampai ratusan ribu, dan supaya tak perlu migrasi ulang kelak.
 *   - **Keunikan ditegakkan DB** (`UNIQUE`); fungsi ini hanya pembuat kandidat.
 *
 * KENAPA BUKAN BERURUTAN (000001, 000002, …):
 *   - membocorkan jumlah aset, dan bisa dienumerasi dengan mudah.
 *   - `{{img:a7Kx9mP2}}` tidak memberi tahu apa pun tentang isi galeri.
 */
import { randomInt } from "node:crypto";

export const SHORT_ID_LENGTH = 8;

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const ALPHABET_LEN = ALPHABET.length;

/** Satu kandidat short_id. BELUM dijamin unik — DB yang menjamin. */
export function generateShortId(): string {
  let out = "";
  for (let i = 0; i < SHORT_ID_LENGTH; i++) {
    out += ALPHABET[randomInt(0, ALPHABET_LEN)];
  }
  return out;
}

/** Cek bentuk — cerminan CHECK `chk_media_assets_short_id` di DB. */
export function isValidShortId(value: string): boolean {
  return new RegExp(`^[0-9A-Za-z]{${SHORT_ID_LENGTH}}$`).test(value);
}

/**
 * Kandidat yang dipastikan belum terpakai.
 *
 * @param isTaken predikat async: true bila kandidat sudah ada di DB
 * @param maxAttempts pengaman; tabrakan melebihi ini menandakan bug
 */
export async function generateUniqueShortId(
  isTaken: (candidate: string) => Promise<boolean>,
  maxAttempts = 20,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = generateShortId();
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error(
    `Gagal membuat short_id unik setelah ${maxAttempts} percobaan — periksa generator atau constraint DB.`,
  );
}
