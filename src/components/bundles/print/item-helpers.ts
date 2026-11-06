import { correctLabelsOf } from "@/lib/contracts/question";
import type { BundleItemView } from "@/lib/hooks/use-bundles";

/**
 * Pembaca kecil untuk data soal di jalur CETAK.
 *
 * KENAPA dipisah dari komponen: dipakai oleh naskah, lembar kunci, lembar
 * pembahasan, dan lembar jawaban. Kalau masing-masing membaca ulang, label
 * nomor bisa berbeda antar-lembar — dan kunci terbaca ke butir yang salah.
 */

/** Baca label opsi benar dari `answerKey` (bila ada). */
export function itemCorrectLabels(item: BundleItemView): string[] {
  return correctLabelsOf(item.question.answerKey);
}

/** Baca teks pembahasan dari `answerKey` (bila ada). */
export function explanationOf(item: BundleItemView): string | null {
  const key = item.question.answerKey;
  if (!key) return null;
  const exp = key.explanation ?? (key as Record<string, unknown>).explanationMarkdown;
  if (typeof exp === "string" && exp.trim().length > 0) return exp.trim();
  return null;
}

/**
 * Label nomor butir yang dipakai SEMUA daftar cetak (naskah, kunci, pembahasan,
 * lembar jawaban). Nomor kustom dari Slot Inspector ("1a", "Wacana 1") harus
 * muncul identik di keempatnya; kalau tidak, kunci bisa dibaca ke butir salah.
 */
export function labelOf(item: BundleItemView, ordinal: number): string {
  const custom = item.item.itemNumber;
  if (!custom) return `${ordinal}.`;
  return custom.endsWith(".") ? custom : `${custom}.`;
}
