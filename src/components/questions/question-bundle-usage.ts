/**
 * QuestionBundleUsage — DTO reverse-projection & pembaca asal-usul naskah.
 *
 * Menerima `bundles[]` dari respons `getQuestion` (`src/lib/services/question-read.ts`).
 * Berkas ini SENGAJA murni tanpa direktif `"use client"` agar dapat dipanggil
 * secara aman baik oleh Server Component maupun Client Component tanpa memicu
 * regresi hidrasi React #441.
 */

export type QuestionBundleRole = "question" | "stimulus";

export interface QuestionBundleUsage {
  bundleId: string;
  bundleTitle: string;
  bundleType: string;
  itemNumber: string | null;
  sectionName: string | null;
  role: QuestionBundleRole;
  year: number | null;
  grade?: string | null;
  sourceLabel?: string | null;
  status: string;
}

/**
 * Pembaca aman daftar naskah dari objek soal detail, mentoleransi ketiadaan field.
 */
export function readBundleUsages(question: unknown): QuestionBundleUsage[] {
  if (typeof question !== "object" || question === null) return [];
  const raw = (question as { bundles?: unknown }).bundles;
  if (!Array.isArray(raw)) return [];

  return raw.map((b) => {
    const item = b as Record<string, unknown>;
    return {
      bundleId: String(item.id ?? ""),
      bundleTitle: String(item.title ?? "Tanpa Judul"),
      bundleType: String(item.bundleType ?? "exam"),
      itemNumber: typeof item.itemNumber === "string" ? item.itemNumber : null,
      sectionName: typeof item.sectionName === "string" ? item.sectionName : null,
      role: item.role === "stimulus" ? "stimulus" : "question",
      year: typeof item.year === "number" ? item.year : null,
      grade: typeof item.grade === "string" ? item.grade : null,
      sourceLabel: typeof item.sourceLabel === "string" ? item.sourceLabel : null,
      status: String(item.status ?? "draft"),
    };
  });
}
