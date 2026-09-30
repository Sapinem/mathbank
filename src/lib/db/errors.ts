import { ConflictError } from "@/lib/auth/guards";

/**
 * Deteksi pelanggaran UNIQUE Postgres (SQLSTATE 23505).
 *
 * Drizzle `postgres-js` membungkus error DB dengan `code` di objek error
 * (atau `cause`). Kita periksa keduanya + heuristik pesan agar tahan versi.
 */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string };
  if (e?.code === "23505" || e?.cause?.code === "23505") return true;
  const msg = e?.message ?? "";
  return /duplicate key|unique constraint/i.test(msg);
}

/**
 * Jalankan operasi DB yang bisa memicu pelanggaran UNIQUE; ubah ke
 * `ConflictError` (409) agar klien menerima pesan ramah, bukan 500 mentah.
 *
 * **D8:** tanpa ini, benturan `slug`/`code` unik bocor sebagai 500
 * `INTERNAL_ERROR` — membingungkan & menyembunyikan penyebab sebenarnya.
 *
 * @param message pesan 409 (sebaiknya menyebut entitas, mis. "Nama label sudah dipakai.")
 */
export async function withUniqueGuard<T>(
  fn: () => Promise<T>,
  message = "Data dengan nilai unik itu sudah ada.",
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isUniqueViolation(err)) throw new ConflictError(message);
    throw err;
  }
}
