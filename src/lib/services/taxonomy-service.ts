/**
 * Service taksonomi — SUMBER, EVENT, TAG, GRADE (L5) — **barrel** kompatibilitas.
 *
 * Semula 569 baris; dipecah per-tanggung-jawab (SRP, CONSTRAINTS #16):
 *  - `taxonomy/shared.ts` → tipe publik (`SourceRow`, `EventRow`, `TagRow`, …).
 *  - `taxonomy/source.ts` → CRUD sumber (+ check RESTRICT via bundle).
 *  - `taxonomy/event.ts`  → CRUD event.
 *  - `taxonomy/tag.ts`    → CRUD label, `cleanUnusedTags`, `mergeTags`.
 *  - `taxonomy/grade.ts`  → daftar jenjang (baca-saja).
 *
 * Impor lama (`@/lib/services/taxonomy-service`) tetap bekerja — tak ada
 * perubahan di call-site.
 *
 * ⚠️ JANGAN impor file ini dari komponen klien (menarik `@/lib/db`).
 */

// Tipe publik (re-export).
export type {
  SourceKind,
  SourceRow,
  EventRow,
  TagRow,
  GradeRow,
  EventInput,
} from "./taxonomy/shared";

// Grade.
export { listGrades } from "./taxonomy/grade";

// Sumber.
export { listSources, createSource, updateSource, deleteSource } from "./taxonomy/source";

// Event.
export { listEvents, createEvent, updateEvent, deleteEvent } from "./taxonomy/event";

// Tag / Label.
export {
  listTags,
  createTag,
  updateTag,
  deleteTag,
  cleanUnusedTags,
  mergeTags,
} from "./taxonomy/tag";
