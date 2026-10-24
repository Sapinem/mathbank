/**
 * Idempotensi ingest (M9-3) — fungsi murni.
 *
 * Dua tingkat:
 *   - `articleHash(rawContent)` — deteksi artikel yang sama (jangan proses ulang).
 *   - `contentHash(stem, options)` — deteksi SOAL yang sama (jangan buat ulang),
 *     berbasis KONTEN **tanpa `source`** (ADR-0012): soal identik dari sumber
 *     berbeda = SAMA (many-to-many via `question_sources`).
 */
import { createHash } from "node:crypto";

/** SHA-256 heksadesimal dari string (dinormalisasi spasi tepi). */
export function sha256(s: string): string {
  return createHash("sha256").update(s.trim(), "utf8").digest("hex");
}

/**
 * Format blok rumus matematika di dalam delimiter.
 * - Bersihkan spasi ganda dan trim tepi.
 * - Standarisasi spasi di sekitar operator biner/relasi umum (+, -, =, <, >).
 * - Melindungi notasi ilmiah (mis. 1e-5, 2e+3) agar tidak terpecah menjadi pengurangan/penjumlahan.
 */
function formatMathBlock(body: string, display: boolean): string {
  let cleaned = body.replace(/\s+/g, " ").trim();

  // Lindungi notasi ilmiah (mis. 1e-5, 2.5e+3, 1E-10) dari pemisahan spasi operator
  const placeholders: string[] = [];
  cleaned = cleaned.replace(/\b\d+(?:\.\d+)?[eE][+-]?\d+\b/g, (match) => {
    placeholders.push(match);
    return `VARSCINOT${placeholders.length - 1}`;
  });

  cleaned = cleaned.replace(
    /([a-zA-Z0-9\)\}\]])\s*([=+\-<>])\s*([a-zA-Z0-9\(\{\[\\])/g,
    "$1 $2 $3",
  );

  cleaned = cleaned.replace(/\bVARSCINOT(\d+)\b/g, (_m, idx) => placeholders[Number(idx)]!);
  return display ? `\\[${cleaned}\\]` : `\\(${cleaned}\\)`;
}

/**
 * Normalisasi delimiter dan spasi KaTeX (CONSTRAINT #29).
 * - `$$...$$` → `\[...\]` (display math).
 * - `$...$` → `\(...\)` (inline math).
 * - Rapikan spasi di awal/akhir blok matematika dan spasi di sekitar operator.
 */
export function normalizeMathDelimiters(text: string): string {
  if (!text) return "";

  // 1) Display math: $$ ... $$ -> \[ ... \]
  let out = text.replace(/(?<!\\)\$\$([\s\S]+?)(?<!\\)\$\$/g, (_m, body: string) => {
    return formatMathBlock(body, true);
  });

  // Display math: \[ ... \] -> standarisasi isi
  out = out.replace(/(?:\\\[|\\\\\[)([\s\S]+?)(?:\\\]|\\\\\])/g, (_m, body: string) => {
    return formatMathBlock(body, true);
  });

  // 2) Inline math: $ ... $ (non-display, baris tunggal) -> \( ... \)
  out = out.replace(/(?<![\$\\])\$([^$\n]+?)(?<!\\)\$(?!\$)/g, (_m, body: string) => {
    return formatMathBlock(body, false);
  });

  // Inline math: \( ... \) -> standarisasi isi
  out = out.replace(/(?:\\\(|\\\\\()([\s\S]+?)(?:\\\)|\\\\\))/g, (_m, body: string) => {
    return formatMathBlock(body, false);
  });

  return out;
}

/**
 * Normalisasi teks: rapikan whitespace.
 *
 * KRITIS (ADR-0012): Jangan ubah delimiter KaTeX di sini ($ -> \( atau spasi math).
 * 11.889 soal di Postgres di-hash dengan normalisasi spasi murni ini.
 * Mengubah fungsi ini memecah dedup exact (ADR-0012) pada data yang ada.
 */
export function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Hash artikel: identitas isi mentah. */
export function articleHash(rawContent: string): string {
  return sha256(rawContent);
}

/**
 * Hash soal: sumber + teks soal. ⚠️ DEPRECATED (ADR-0012) — memakai `source`
 * membuat soal identik dari sumber berbeda dianggap beda (memicu duplikat).
 * Gunakan `contentHash(stem, options)` untuk dedup lintas-sumber.
 */
export function itemHash(source: string, stem: string): string {
  return sha256(`${source}\u0000${stem.replace(/\s+/g, " ").trim()}`);
}

/**
 * Hash konten soal (ADR-0012): **stem + opsi**, TANPA sumber.
 *
 * - Opsi dibandingkan sebagai **himpunan teks** (label & urutan diabaikan →
 *   tahan opsi teracak), sesuai keputusan pemilik produk.
 * - Soal dengan stem + opsi sama (walau dari sumber berbeda) → hash sama.
 */
export function contentHash(stem: string, options: string[] = []): string {
  const normStem = normalizeText(stem);
  const normOpts = options
    .map(normalizeText)
    .filter((o) => o.length > 0)
    .sort();
  return sha256(`${normStem}\u0000${normOpts.join("\u0001")}`);
}
