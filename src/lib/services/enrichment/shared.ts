/**
 * Tipe & utilitas bersama enrichment (L5) — pecahan `enrichment-service.ts`.
 *
 * Tanpa I/O. `slugify` **CORR-02**: batas 100 char (kolom terketat `tags.slug`).
 */
import type { EnrichmentProposal } from "@/lib/contracts/ai";

export interface EnrichOutcome {
  questionId: string;
  ok: boolean;
  proposal?: EnrichmentProposal;
  error?: string;
  /** Status soal sesudah (review bila sukses dari draft). */
  status?: string;
  /**
   * Laporan kontrak pedagogi (MAT-41): galat KaTeX, rationale pengecoh yang
   * belum lengkap, dan rubrik esai yang belum sah. `ok` kontrak = semua bersih.
   */
  pedagogy?: {
    ok: boolean;
    katexIssues: number;
    rationaleIssues: number;
    rubricIssues: number;
    /** Jumlah opsi pengecoh yang rationale-nya diterapkan dari usulan AI. */
    rationaleApplied: number;
    /** True bila rubrik diterapkan dari usulan AI. */
    rubricApplied: boolean;
  };
}

/**
 * Slug sederhana. **CORR-02:** batas **100** char karena `tags.slug` adalah
 * `varchar(100)` (topics 255, tapi ambil batas terketat agar satu fungsi aman).
 * `normalize("NFKD")` bisa MEMPERPANJANG string (ligatur `ﬃ`→`ffi`), jadi potong
 * SETELAH normalisasi & buang `-` ekor sesudah potong — bukan sebelum.
 */
export function slugify(s: string, maxLength = 100): string {
  const base = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return base || "untitled";
}
