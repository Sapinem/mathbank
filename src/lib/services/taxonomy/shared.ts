/**
 * Tipe & utilitas bersama service taksonomi (L5) — pecahan `taxonomy-service.ts`.
 *
 * Dipakai `source.ts`, `event.ts`, `tag.ts`, `grade.ts`. Berisi hanya TIPE
 * (tanpa I/O) + re-export `slugify` murni, agar modul-modul saudara berbagi
 * kontrak tanpa saling mengimpor logika.
 *
 * ⚠️ JANGAN impor dari komponen klien (rantai ini menarik `@/lib/db` lewat
 * modul CRUD-nya).
 */

/** Jenis sumber referensi. */
export type SourceKind = "book" | "website" | "school";

export interface SourceRow {
  id: string;
  kind: SourceKind;
  label: string;
  slug: string;
  url: string | null;
  /** Khusus `kind='book'`. */
  publisher: string | null;
  author: string | null;
  bookYear: number | null;
  /** Khusus `kind='school'`. */
  city: string | null;
  isActive: boolean;
  usageCount: number;
}

export interface EventRow {
  id: string;
  name: string;
  shortname: string;
  category: string;
  subtests: string[];
  aliases: string[];
  isActive: boolean;
}

export interface TagRow {
  id: string;
  name: string;
  slug: string;
  usageCount: number;
}

export interface GradeRow {
  id: string;
  label: string;
  levelGroup: string | null;
  curriculumPhase: string | null;
  orderIndex: number;
}

export interface EventInput {
  name: string;
  shortname: string;
  category: string;
  subtests?: string[];
  aliases?: string[];
}

export { slugify } from "@/lib/taxonomy/tree";
