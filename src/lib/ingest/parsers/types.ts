/**
 * Tipe segmen & adapter ingest (M9) — selaras dengan `contracts/question.ts`.
 *
 * Lapisan ini **tahu soal & sumber** (berbeda dari `clean.ts` yang general).
 * Fungsi murni (L6, tanpa DB/network).
 */
import type { z } from "zod";
import type { questionTypeSchema } from "@/lib/contracts/question";

export type ParsedQuestionType = z.infer<typeof questionTypeSchema>;

/** Satu soal hasil ekstraksi (sebelum disimpan ke DB). */
export interface ParsedItem {
  /** Jenis soal (default `single_choice`; `essay` bila tak ada opsi). */
  type: ParsedQuestionType;
  /** Teks soal (math sudah \(...\) / \[...\]). */
  stem: string;
  /** Opsi jawaban (kosong bila essay). */
  options: ParsedOption[];
  /** Kunci jawaban — label opsi benar (mis. ["A"]); kosong bila tak pasti. */
  correct: string[];
  /** Pupuk pembahasan (bila ada). */
  explanation?: string;
  /** Catatan mutu (mis. "kunci tak ditemukan", "opsi hanya 3"). */
  warnings: string[];
  /** Payload khusus tipe (mis. matrix_grid: pernyataan + label). */
  dataPayload?: Record<string, unknown>;
  /** Jejak asal dalam artikel (untuk verifikasi). */
  ref: { index: number; heading?: string };
}

export interface ParsedOption {
  label: string;
  text: string;
  isCorrect: boolean;
}

/** Hasil segmentasi satu artikel. */
export interface SegmentResult {
  items: ParsedItem[];
  /** Jumlah blok yang dilewati (bukan soal). */
  skipped: number;
  warnings: string[];
}

/** Metadata artikel (dari file korpus). */
export interface ArticleMeta {
  /** Nama sumber (mathcyber | m4thlab | defantri | pusmendik_*). */
  source: string;
  url?: string;
  title?: string;
}

/**
 * Kontrak tiap adapter: terima HTML (mentah) → hasil segmentasi.
 * Adapter memakai `cleanHtml` di dalam untuk membersihkan blok yang relevan.
 */
export type ArticleAdapter = (rawHtml: string, meta?: ArticleMeta) => SegmentResult;

/**
 * Adapter untuk sumber **JSON terstruktur** (mis. pusmendik_dayaserap) —
 * tak butuh parsing HTML; data sudah terurai.
 */
export type JsonAdapter = (data: unknown, meta: ArticleMeta) => SegmentResult;
