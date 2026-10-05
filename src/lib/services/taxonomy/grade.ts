/**
 * Grade (jenjang/kelas) — referensi baca-saja (L5). Pecahan `taxonomy-service`.
 *
 * ⚠️ JANGAN impor dari komponen klien (menarik `@/lib/db`).
 */
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { grades } from "@/lib/db/schema/taxonomy";
import type { GradeRow } from "./shared";

/**
 * Daftar jenjang/kelas aktif (referensi baca-saja) — sumber tunggal untuk
 * editor & filter. Format selaras QBank (`curriculum.yaml`): `id` = nomor kelas
 * / kode ("1".."12", "11w", "utbk", "umum"), `label` = "Kelas N SD/SMP/SMA".
 */
export async function listGrades(): Promise<GradeRow[]> {
  return db
    .select({
      id: grades.id,
      label: grades.label,
      levelGroup: grades.levelGroup,
      curriculumPhase: grades.curriculumPhase,
      orderIndex: grades.orderIndex,
    })
    .from(grades)
    .where(eq(grades.isActive, true))
    .orderBy(asc(grades.orderIndex), asc(grades.id));
}
