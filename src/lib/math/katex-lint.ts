/**
 * KaTeX linter pre-save (G2.4).
 *
 * Mengekstrak seluruh potongan rumus dari markdown lalu menguji tiap rumus ke
 * KaTeX dengan `throwOnError: true` — sehingga galat sintaks (mis. `\frac{1}`)
 * terdeteksi SEBELUM tersimpan, bukan baru saat render di klien.
 *
 * Dipakai editor soal: menampilkan peringatan inline + opsi tandai (flag).
 * **Tidak** memblokir simpan — hanya memberi peringatan (keputusan G2).
 */
import katex from "katex";
import { tokenizeMath } from "@/components/math/math-content";

export interface KatexDiagnostic {
  /** Potongan rumus yang bermasalah (mentah). */
  expression: string;
  /** Pesan galat dari KaTeX (sudah dibersihkan dari HTML). */
  message: string;
  /** Perkiraan nomor baris (1-indeks) tempat rumus berada di markdown. */
  line: number;
  /** Display mode (blok `$$`/`\[`) atau inline (`$`/`\(`). */
  display: boolean;
}

/** Bersihkan pesan galat KaTeX dari tag/atribut agar aman & ringkas. */
function cleanMessage(msg: string): string {
  return msg
    .replace(/<[^>]*>/g, "")
    .replace(/KaTeX parse error:\s*/i, "")
    .trim();
}

/**
 * Periksa seluruh rumus dalam `markdown`. Mengembalikan daftar diagnostik
 * (kosong = semua rumus valid). Toleran: teks biasa tanpa rumus → `[]`.
 */
export function lintKatex(markdown: string): KatexDiagnostic[] {
  const diags: KatexDiagnostic[] = [];
  if (!markdown || !markdown.trim()) return diags;

  // Hitung nomor baris awal tiap token (jumlah "\n" sebelum posisi).
  const tokens = tokenizeMath(markdown);

  for (const t of tokens) {
    if (t.kind !== "math") continue;
    try {
      katex.renderToString(t.value, {
        displayMode: t.display,
        throwOnError: true,
        strict: false,
        output: "html",
      });
    } catch (err) {
      const message =
        err instanceof Error ? cleanMessage(err.message) : "Rumus tidak valid.";
      diags.push({
        expression: t.value,
        message,
        // tokenizeMath tak membawa posisi; cari kemunculan ekspresi di sumber.
        line: lineOf(markdown, t.value),
        display: t.display,
      });
    }
  }
  return diags;
}

/** Nomor baris (1-indeks) kemunculan pertama `needle` dalam `text`. */
function lineOf(text: string, needle: string): number {
  const idx = text.indexOf(needle);
  if (idx < 0) return 1;
  return text.slice(0, idx).split("\n").length;
}

/** True bila seluruh rumus valid (untuk gate/pemeriksaan cepat). */
export function isKatexValid(markdown: string): boolean {
  return lintKatex(markdown).length === 0;
}
