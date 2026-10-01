/** Label & gaya tampilan untuk enum soal (Bahasa Indonesia). */

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draf",
  review: "Perlu Telaah",
  ready: "Siap",
  archived: "Arsip",
};

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
