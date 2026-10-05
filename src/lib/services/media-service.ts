/**
 * Service media (L5) — **barrel** untuk kompatibilitas impor.
 *
 * Semula 479 baris; dipecah per-tanggung-jawab (SRP, CONSTRAINTS #16):
 *  - `media/shared.ts`   → tipe publik + proyeksi `GALLERY_COLUMNS`.
 *  - `media/register.ts` → daftar/kaitkan aset (`registerMediaAsset`, upload, dll).
 *  - `media/hygiene.ts`  → cari/hapus/orphan (`findAssetByShortId`, `deleteAsset`, …).
 *  - `media/gallery.ts`  → daftar & metadata galeri (`listMedia`, `getMediaDetail`).
 *
 * Impor lama (`@/lib/services/media-service`) tetap bekerja — tak ada perubahan
 * di call-site.
 *
 * ⚠️ JANGAN impor file ini dari komponen klien (menarik `@/lib/db`).
 */

// Tipe publik (re-export).
export type {
  MediaRole,
  MediaOrigin,
  RegisterMediaInput,
  RegisterMediaResult,
  AssetHandle,
  StoreAndRegisterInput,
  UploadMediaResult,
} from "./media/shared";

// Pendaftaran & penautan.
export {
  registerMediaAsset,
  linkMediaToQuestion,
  registerAndLink,
  storeAndRegister,
  uploadMedia,
  attachStoredMedia,
} from "./media/register";

// Hygiene & pencarian.
export {
  findAssetByShortId,
  isAssetInUse,
  listQuestionMedia,
  detachAndCleanup,
  findOrphanAssets,
  deleteAsset,
} from "./media/hygiene";

// Galeri.
export { listMedia, getMediaDetail, updateMediaMeta } from "./media/gallery";
