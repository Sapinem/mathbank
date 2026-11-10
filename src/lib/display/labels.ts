/** Label & gaya tampilan untuk enum soal (Bahasa Indonesia). */

import type { LucideIcon } from "lucide-react";
import {
  FilePenLine,
  Clock,
  CheckCircle2,
  Archive,
  HelpCircle,
} from "lucide-react";

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draf",
  review: "Perlu Telaah",
  ready: "Siap",
  archived: "Arsip",
};

/** Label status ringkas (mis. untuk kartu atau tombol filter yang sempit). */
export const STATUS_SHORT_LABELS: Record<string, string> = {
  draft: "Draf",
  review: "Telaah",
  ready: "Siap",
  archived: "Arsip",
};

/** Ikon Lucide resmi per status FSM. */
export const STATUS_ICONS: Record<string, LucideIcon> = {
  draft: FilePenLine,
  review: Clock,
  ready: CheckCircle2,
  archived: Archive,
};

/** Ambil komponen ikon Lucide untuk status tertentu (fallback: HelpCircle). */
export function getStatusIcon(status: string): LucideIcon {
  return STATUS_ICONS[status] ?? HelpCircle;
}

export const TYPE_LABELS: Record<string, string> = {
  stimulus: "Stimulus",
  single_choice: "Pilihan Ganda",
  assertion_reason: "Sebab-Akibat",
  combination_1234: "Kombinasi 1-2-3-4",
  quantitative_pq: "Kuantitatif P-Q",
  data_sufficiency: "Kecukupan Data",
  multiple_choice_checkbox: "PG Kompleks",
  matrix_grid: "Matriks B-S",
  matching: "Menjodohkan",
  short_answer: "Isian Singkat",
  essay: "Uraian",
};

export const COGNITIVE_LABELS: Record<string, string> = {
  remember: "C1 · Mengingat",
  understand: "C2 · Memahami",
  apply: "C3 · Menerapkan",
  analyze: "C4 · Menganalisis",
  evaluate: "C5 · Mengevaluasi",
  create: "C6 · Mencipta",
};

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Sangat Mudah",
  2: "Mudah",
  3: "Sedang",
  4: "Sulit",
  5: "Sangat Sulit",
};

/** Label peran (Bahasa Indonesia). */
export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  teacher: "Guru",
  reviewer: "Penelaah",
  agent: "Agen",
  machine: "Mesin",
};

/** Asal aset media — cerminan `mediaOriginEnum`. */
export const MEDIA_ORIGIN_LABELS: Record<string, string> = {
  manual_upload: "Unggahan",
  pdf_crop: "Potongan PDF",
  ai_generated_tikz: "AI · TikZ",
  ai_generated_svg: "AI · SVG",
  web_scrape: "Comot Web",
  web_ingest: "Ingest Web",
  tex_import: "Impor TeX",
};

/** Peran media dalam soal — cerminan `mediaRoleEnum`. */
export const MEDIA_ROLE_LABELS: Record<string, string> = {
  content: "Isi Soal",
  option: "Pilihan",
  solution: "Pembahasan",
  thumbnail: "Miniatur",
};

/**
 * Warna status (UNIVERSAL — tak ikut brand; "Siap" = biru brand).
 * Mengembalikan kelas Tailwind sesuai aturan RENCANA-UI §6.
 */
export function statusClass(status: string): string {
  switch (status) {
    case "ready":
      return "bg-brand/10 text-brand border-brand/20";
    case "review":
      return "bg-gold/15 text-gold-fg border-gold/30";
    case "archived":
      return "bg-muted text-muted-foreground border-border";
    default: // draft
      return "bg-muted text-muted-foreground border-border";
  }
}

/** Warna tingkat kesulitan (universal). */
export function difficultyClass(d: number): string {
  if (d <= 2) return "text-success";
  if (d === 3) return "text-muted-foreground";
  if (d === 4) return "text-warning";
  return "text-error";
}

/**
 * Warna semantik badge level kognitif (C1–C6).
 * Warna naik mengikuti kedalaman proses berpikir (teal→rose→emerald).
 */
export function cognitiveClass(level: string): string {
  switch (level) {
    case "remember":
      return "border-info/40 bg-info/10 text-info";
    case "understand":
      return "border-brand/30 bg-brand/10 text-brand";
    case "apply":
      return "border-success/40 bg-success/10 text-success";
    case "analyze":
      return "border-warning/40 bg-warning/10 text-warning";
    case "evaluate":
      return "border-error/40 bg-error/10 text-error";
    case "create":
      return "border-gold/40 bg-gold/15 text-gold-fg";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

/** Kode ringkas level kognitif untuk badge mikro, mis. "C4". */
export function cognitiveCode(level: string): string {
  const map: Record<string, string> = {
    remember: "C1",
    understand: "C2",
    apply: "C3",
    analyze: "C4",
    evaluate: "C5",
    create: "C6",
  };
  return map[level] ?? "—";
}

/** Format jenjang kelas ringkas: "10", "11W", "11L", "SMP 08", "SD 04", dsb. */
export function formatGradeBadge(grade: string): string {
  const g = grade.trim();
  const lower = g.toLowerCase();

  // SMP (7, 8, 9) -> "07", "08", "09" (hanya angka 2 digit tanpa teks 'SMP')
  if (lower.startsWith("smp")) {
    const num = lower.replace("smp", "").replace(/[^0-9]/g, "");
    return num ? num.padStart(2, "0") : g.toUpperCase();
  }
  if (["7", "8", "9"].includes(lower)) {
    return `0${lower}`;
  }

  // SD (1 s/d 6) -> "01" s/d "06" (hanya angka 2 digit tanpa teks 'SD')
  if (lower.startsWith("sd")) {
    const num = lower.replace("sd", "").replace(/[^0-9]/g, "");
    return num ? num.padStart(2, "0") : g.toUpperCase();
  }
  if (["1", "2", "3", "4", "5", "6"].includes(lower)) {
    return `0${lower}`;
  }

  // SMA Wajib / Lanjut
  if (lower === "11w" || lower === "sma-11w") return "11W";
  if (lower === "11l" || lower === "sma-11l") return "11L";
  if (lower === "12w" || lower === "sma-12w") return "12W";
  if (lower === "12l" || lower === "sma-12l") return "12L";

  // SMA Standar / Ujian
  if (lower === "10" || lower === "sma-10") return "10";
  if (lower === "11") return "11";
  if (lower === "12") return "12";
  if (lower === "utbk") return "UTBK";
  if (lower === "mandiri") return "MDR";
  if (lower === "umum") return "UMUM";

  return g.toUpperCase();
}
