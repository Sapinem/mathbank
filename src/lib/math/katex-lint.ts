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
import { tokenizeMath } from "@/lib/math/tokenize";

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

  // ⚠️ Jaring pengaman: potongan math "TELANJANG" (tanpa delimiter).
  //
  // `tokenizeMath` hanya mengenali math lewat delimiter (`\[…\]`, `$$…$$`,
  // `$…$`, `\(…\)`). Bila sebuah `\begin{env}…\end{env}` muncul TANPA delimiter
  // (nyata di korpus: sisa `\hline` akibat perbaikan berantai, blok `array`
  // yang delimiter-nya tertelan), potongan itu ditandai `[text]` → **galatnya
  // TERLEWAT** oleh loop di atas. Padahal renderer nyata (`math-content`)
  // tetap menampilkannya sebagai math dan GAGAL.
  //
  // Bukti empiris: 625+ galat `\hline` "tak terlihat" oleh lintKatex versi
  // lama, sehingga gerbang ingest melaporkan 0 padahal UI rusak.
  for (const potong of potonganMathTelanjang(markdown)) {
    try {
      katex.renderToString(potong, {
        displayMode: true,
        throwOnError: true,
        strict: false,
        output: "html",
      });
    } catch (err) {
      const message =
        err instanceof Error ? cleanMessage(err.message) : "Rumus tidak valid.";
      diags.push({
        expression: potong,
        message,
        line: lineOf(markdown, potong),
        display: true,
      });
    }
  }
  return diags;
}

/**
 * Cari potongan math "telanjang" — `\begin{env}…\end{env}` yang TIDAK diawali
 * delimiter math (sehingga tak dikenali `tokenizeMath`). Mengembalikan potongan
 * MENTAH apa adanya (tanpa menambah delimiter), agar diuji persis seperti yang
 * akan dirender klien.
 */
function potonganMathTelanjang(markdown: string): string[] {
  const hasil: string[] = [];
  const env =
    "array|matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|cases|aligned|align\\*?|gathered|split|equation\\*?";
  const re = new RegExp(`\\\\begin\\{(${env})\\}[\\s\\S]*?\\\\end\\{\\1\\}`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    // Sudah di dalam region math ber-delimiter? → lewati (sudah diperiksa).
    const sebelum = markdown.slice(Math.max(0, m.index - 6), m.index);
    if (/(?:\\\[|\\\(|\$\$?)\s*$/.test(sebelum)) continue;
    // Jika ekspresi ini ADA di dalam salah satu token math, lewati.
    hasil.push(m[0]);
  }
  return hasil;
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
