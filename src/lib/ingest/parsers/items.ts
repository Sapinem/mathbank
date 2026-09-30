/**
 * Aturan mutu bersama untuk semua adapter (M9) — fungsi murni.
 *
 * Prinsip (dari pengalaman QBank):
 *   - **Jangan menebak kunci** — kunci kosong > kunci salah.
 *   - Opsi < 2 → `essay` (soal uraian itu sah).
 *   - Opsi 2–4 → beri catatan ("opsi tak lengkap") tapi tetap simpan.
 *   - Semua hasil masuk sebagai **draft** (diputuskan lapisan berikutnya).
 */
import type { ParsedItem, ParsedOption } from "./types";

/** Label huruf standar untuk opsi. */
const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

/** Label untuk indeks 0-based (0→A, 1→B, …). */
export function labelFor(index: number): string {
  return LABELS[index] ?? String(index + 1);
}

/**
 * Finalisasi satu item: tentukan `type` dari jumlah opsi, tandai `isCorrect`
 * berdasarkan kunci, dan tambahkan catatan mutu.
 *
 * @param correctLabels label opsi yang benar (mis. ["A"]); kosong = tak pasti.
 */
export function finalizeItem(
  stem: string,
  rawOptions: { label?: string; text: string }[],
  correctLabels: string[],
  explanation: string | undefined,
  ref: { index: number; heading?: string },
  extraWarnings: string[] = [],
): ParsedItem {
  const warnings = [...extraWarnings];
  const options: ParsedOption[] = rawOptions.map((o, i) => ({
    label: o.label && o.label.trim() ? o.label.trim() : labelFor(i),
    text: o.text.trim(),
    isCorrect: false,
  }));

  // Buang opsi kosong (temuan: kadang ada <li> hampa).
  const clean = options.filter((o) => o.text.length > 0);

  const hasOptions = clean.length >= 2;
  const type = hasOptions ? "single_choice" : "essay";

  if (hasOptions && clean.length < 4) {
    warnings.push(`Opsi hanya ${clean.length} — mungkin parsing kurang`);
  }
  if (!hasOptions && clean.length === 1) {
    warnings.push("Hanya 1 opsi terdeteksi — diperlakukan sebagai essay");
  }

  // Tandai kunci (hanya bila label cocok dengan opsi yang ada).
  const labelSet = new Set(clean.map((o) => o.label.toUpperCase()));
  const valid = correctLabels.map((l) => l.toUpperCase()).filter((l) => labelSet.has(l));
  for (const o of clean) {
    if (valid.includes(o.label.toUpperCase())) o.isCorrect = true;
  }
  if (valid.length === 0) {
    warnings.push("Kunci jawaban tidak ditemukan — perlu telaah");
  }

  return {
    type,
    stem: stem.trim(),
    options: hasOptions ? clean : [],
    correct: valid,
    explanation: explanation?.trim() || undefined,
    warnings,
    ref,
  };
}

/** Gabungkan hasil beberapa adapter/potongan menjadi satu `SegmentResult`. */
export function mergeResults(results: { items: ParsedItem[]; skipped: number; warnings: string[] }[]) {
  return {
    items: results.flatMap((r) => r.items),
    skipped: results.reduce((a, r) => a + r.skipped, 0),
    warnings: results.flatMap((r) => r.warnings),
  };
}
