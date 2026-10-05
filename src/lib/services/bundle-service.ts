/**
 * Layanan paket soal (L5) — **barrel** untuk kompatibilitas impor.
 *
 * Semula 665 baris; dipecah per-tanggung-jawab (SRP, CONSTRAINTS #16):
 *  - `bundle-shared.ts` → tipe, proyeksi kolom, otorisasi, slug unik.
 *  - `bundle-query.ts`  → baca paket + item + validasi + cek pemakaian soal.
 *  - `bundle-write.ts`  → mutasi metadata: buat, perbarui, arsip, duplikasi.
 *  - `bundle-items.ts`  → pengelolaan item: tambah, hapus, susun-ulang.
 *
 * Impor lama (`@/lib/services/bundle-service`) tetap bekerja — tak ada
 * perubahan di call-site. Impor spesifik boleh diarahkan ke modul baru bila
 * ingin lebih jelas.
 *
 * ⚠️ JANGAN impor file ini dari komponen klien (menarik `@/lib/db`).
 */

// Tipe publik (re-export).
export type {
  BundleType,
  BundleItemRole,
  BundleRow,
  BundleItemRow,
  BundleItemWithQuestion,
  CreateBundleInput,
  UpdateBundleInput,
  BundleValidation,
} from "./bundle-shared";

// Baca (query).
export {
  listBundles,
  getBundle,
  listBundleItems,
  validateBundle,
  isQuestionUsedInBundles,
  bundlesUsingQuestions,
} from "./bundle-query";

// Mutasi metadata (write).
export {
  createBundle,
  updateBundle,
  archiveBundle,
  duplicateBundle,
} from "./bundle-write";

// Pengelolaan item (items).
export { addItem, removeItem, reorderItems } from "./bundle-items";

// Otorisasi per-paket (dipakai `moodle-export-service` & lintas modul).
export { assertBundleWrite, assertBundleRead } from "./bundle-shared";
