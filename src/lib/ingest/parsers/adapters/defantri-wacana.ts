/**
 * Dukungan WACANA / STIMULUS untuk adapter defantri — fungsi murni.
 *
 * Bentuk sumber (terverifikasi: 1 artikel, `2024-09-soal-penalaran-matematika`):
 *   <p>…wacana panjang… <img/></p>              ← WACANA (stem induk)
 *   <blockquote>$\left( 1 \right).$ …soal…  <div class="question"> radio q1 </div></blockquote>
 *   <blockquote>$\left( 2 \right).$ …soal…  radio q2</blockquote>
 *   … hingga (n)
 *
 * Kriteria WAJIB (temuan: membedakan wacana asli dari penomoran persamaan):
 *   - penanda `$\left( n \right).$` berurutan mulai dari 1
 *   - tiap nomor menunjuk grup radio BERBEDA (q1,q2,q3,…)
 *   Penomoran persamaan `\cdots \left( 1 \right)` menunjuk radio SAMA → ditolak.
 */
import { cleanHtml } from "../clean";

/** Penanda sub-soal: `$\left( 1 \right).$`. */
const MARKER = /\$\s*\\left\(\s*(\d{1,2})\s*\\right\)\s*[.:]?\s*\$/g;

const RADIO_RE = /<input\b[^>]*type="radio"[^>]*name="([^"]+)"/gi;

export interface WacanaSub {
  /** Nomor sub-soal (1..n). */
  n: number;
  /** Nama grup radio (mis. `q1`). */
  radio: string;
  /** Posisi penanda di HTML. */
  at: number;
}

export interface WacanaGroup {
  /** Teks wacana (stem induk) — sudah bersih. */
  wacana: string;
  /** Sub-soal berurutan yang menunjuk radio berbeda. */
  subs: WacanaSub[];
  /** Posisi awal wacana di HTML. */
  wacanaAt: number;
}

/** Ambil grup radio pertama setelah posisi `from` dalam jarak `window` char. */
function radioAfter(html: string, from: number, window = 4000): string | null {
  const seg = html.slice(from, from + window);
  RADIO_RE.lastIndex = 0;
  const m = RADIO_RE.exec(seg);
  return m ? m[1]! : null;
}

/**
 * Deteksi wacana dalam satu artikel. Mengembalikan `null` bila tak ada
 * rangkaian sub-soal yang memenuhi kriteria.
 */
export function detectWacana(html: string): WacanaGroup | null {
  // 1) Kumpulkan penanda + radio-nya.
  const marks: { n: number; at: number; radio: string | null }[] = [];
  MARKER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKER.exec(html)) !== null) {
    marks.push({ n: Number(m[1]), at: m.index, radio: radioAfter(html, m.index) });
  }
  if (marks.length < 2) return null;

  // 2) Rangkaian berurutan mulai 1, tiap nomor radio BERBEDA.
  const seq: WacanaSub[] = [];
  let expect = 1;
  const used = new Set<string>();
  for (const mk of marks) {
    if (mk.n !== expect || !mk.radio) continue;
    if (used.has(mk.radio)) continue; // radio sama → bukan sub-soal
    used.add(mk.radio);
    seq.push({ n: mk.n, radio: mk.radio, at: mk.at });
    expect++;
  }
  if (seq.length < 2) return null;

  // 3) Wacana = teks antara `<p>` terakhir sebelum sub-soal pertama … MARKER(1).
  const firstAt = seq[0]!.at;
  const wacana = extractWacanaBefore(html, firstAt);
  if (!wacana.text) return null;

  return { wacana: wacana.text, subs: seq, wacanaAt: wacana.start };
}

/**
 * Buang penanda nomor sub-soal di depan stem: `\(\left( 1 \right).\)` (atau
 * varian tanpa `$`, dengan spasi/tanda baca berbeda).
 *
 * Nomor tidak diperlukan di UI karena urutan sudah diwakili `child_order`.
 * Hanya membuang di AWAL teks — nomor di tengah stem tidak disentuh.
 */
export function stripSubNumber(stem: string): string {
  return stem
    // `\(\left( 1 \right).\)` (bentuk utama sumber)
    .replace(/^\s*\\\(\s*\\left\(\s*\d{1,2}\s*\\right\)\s*[.:]?\s*\\\)\s*[.:]?\s*/i, "")
    // `\((4)\)` — tanpa \left/\right, kurung ganda
    .replace(/^\s*\\\(\s*\(\s*\d{1,2}\s*\)\s*\\\)\s*[.:]?\s*/i, "")
    // `\(\left( 3 \right)\)` tanpa titik penutup
    .replace(/^\s*\\\(\s*\\left\(\s*\d{1,2}\s*\\right\)\s*\\\)\s*[.:]?\s*/i, "")
    .trimStart();
}

/**
 * Ambil teks wacana sebelum penanda pertama: paragraf-paragraf terakhir yang
 * mengandung prosa (bukan nav/judul/daftar isi) sebelum sub-soal.
 */
export function extractWacanaBefore(html: string, markerAt: number): { text: string; start: number } {
  const before = html.slice(0, markerAt);
  // Ambil sampai 2 paragraf terakhir sebelum penanda.
  const ps: { start: number; html: string }[] = [];
  for (const m of before.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    ps.push({ start: m.index!, html: m[0] });
  }
  // Dari belakang, ambil paragraf yang cukup panjang (>= 80 char teks bersih).
  const picked: { start: number; html: string }[] = [];
  for (let i = ps.length - 1; i >= 0 && picked.length < 2; i--) {
    const c = cleanHtml(ps[i]!.html);
    if (c.text.trim().length >= 80) picked.unshift(ps[i]!);
    else break; // paragraf pendek (judul/nav) → berhenti
  }
  if (picked.length === 0) return { text: "", start: 0 };
  const joined = picked.map((p) => p.html).join("\n");
  const cleaned = cleanHtml(joined);
  return { text: cleaned.text.trim(), start: picked[0]!.start };
}
