/**
 * Rubrik pedagogis (Bahasa Indonesia) — deskripsi operasional tingkat kesulitan
 * (1–5) & taksonomi Bloom (C1–C6). Dipakai oleh `RubricPopover` (kartu & detail
 * soal) dan helper guide di editor agar klasifikasi soal terstandarisasi objektif.
 *
 * Sumber: audit komparasi QBank §3.7 (kalibrasi kurikulum).
 */

export interface RubricEntry {
  /** Kode ringkas, mis. "C4" atau "Lv.3". */
  code: string;
  /** Judul singkat, mis. "Menganalisis" atau "Sedang". */
  title: string;
  /** Deskripsi operasional (kriteria objektif). */
  description: string;
}

/** Rubrik tingkat kesulitan (1–5). */
export const DIFFICULTY_RUBRICS: Record<number, RubricEntry> = {
  1: {
    code: "Lv.1",
    title: "Sangat Dasar",
    description:
      "Pemahaman konsep dasar, pengenalan simbol, dan perhitungan aritmetika langsung.",
  },
  2: {
    code: "Lv.2",
    title: "Dasar / Mudah",
    description:
      "Penerapan rumus standar satu langkah dan penyelesaian soal rutin yang terdefinisi.",
  },
  3: {
    code: "Lv.3",
    title: "Sedang / Menengah",
    description:
      "Penggabungan dua konsep matematis, manipulasi aljabar, dan analisis data standar.",
  },
  4: {
    code: "Lv.4",
    title: "Lanjutan / Sulit",
    description:
      "Soal setara seleksi ujian nasional/UTBK: multi-tahap dan analisis mendalam.",
  },
  5: {
    code: "Lv.5",
    title: "HOTS / Olimpiade",
    description:
      "Penalaran kompleks, pembuktian teorema, pola abstrak, dan pemecahan masalah non-rutin.",
  },
};

/** Rubrik taksonomi Bloom (C1–C6). */
export const COGNITIVE_RUBRICS: Record<string, RubricEntry> = {
  remember: {
    code: "C1",
    title: "Mengingat",
    description:
      "Mengenali & mengingat kembali fakta, definisi, atau rumus dasar tanpa manipulasi.",
  },
  understand: {
    code: "C2",
    title: "Memahami",
    description:
      "Menjelaskan ide, menafsirkan representasi, dan memberi contoh konsep.",
  },
  apply: {
    code: "C3",
    title: "Menerapkan",
    description:
      "Menggunakan prosedur/rumus pada situasi rutin yang dikenal.",
  },
  analyze: {
    code: "C4",
    title: "Menganalisis",
    description:
      "Menguraikan masalah, menghubungkan beberapa konsep, dan mengidentifikasi pola/hubungan.",
  },
  evaluate: {
    code: "C5",
    title: "Mengevaluasi",
    description:
      "Menilai, mengkritik bukti, atau memilih pendekatan terbaik dengan argumen.",
  },
  create: {
    code: "C6",
    title: "Mencipta",
    description:
      "Menyusun strategi/pembuktian baru atau memecahkan masalah non-rutin secara orisinal.",
  },
};

/** Rubrik kognitif (fallback bila level tak dikenal). */
export function cognitiveRubric(level: string): RubricEntry {
  return (
    COGNITIVE_RUBRICS[level] ?? {
      code: "—",
      title: level,
      description: "Tingkat kognitif belum terklasifikasi.",
    }
  );
}

/** Rubrik kesulitan (fallback bila level di luar 1–5). */
export function difficultyRubric(level: number): RubricEntry {
  return (
    DIFFICULTY_RUBRICS[level] ?? {
      code: `Lv.${level}`,
      title: "Tidak diketahui",
      description: "Tingkat kesulitan belum terklasifikasi.",
    }
  );
}
