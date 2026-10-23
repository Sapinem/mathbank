/**
 * Dukungan BENAR-SALAH (`matrix_grid`) untuk adapter defantri — fungsi murni.
 *
 * Bentuk sumber (terverifikasi di 43 artikel TKA matematika):
 *   <blockquote> …stem…
 *     <ul>                                   ← UL PERNYATAAN = satu soal
 *       <li>pernyataan 1 <div class="question"><input name="q201" value="correct">Benar|Salah</div></li>
 *       <li>pernyataan 2 <div class="question"><input name="q202" …></div></li>
 *     </ul>
 *   </blockquote>
 *
 * Kunci: `value="correct"` (⚠️ `corect` = pengecoh, jangan dianggap kunci).
 */
import { cleanHtml } from "../clean";
import { finalizeItem } from "../items";
import type { ParsedItem } from "../types";

/** Nilai radio penanda KUNCI (toleransi typo; `corect` BUKAN kunci). */
const CORRECT_VALUES = ["correct", "crorect", "corrrect", "crrect", "coorect"];

/** Normalisasi teks opsi → "Benar"/"Salah"/null. */
function asBenarSalah(text: string): "Benar" | "Salah" | null {
  const t = cleanHtml(text).text.trim();
  const hasTrue = /\b(?:benar|true)\b/i.test(t);
  const hasFalse = /\b(?:salah|false)\b/i.test(t);
  if (hasTrue && !hasFalse) return "Benar";
  if (hasFalse && !hasTrue) return "Salah";
  return null;
}

interface RawGroup {
  name: string;
  pos: number;
  end: number;
  opts: { val: string; text: string }[];
}

/** Kumpulkan grup radio: nama → opsi (val + teks bersih). */
function collectRawGroups(html: string): Map<string, RawGroup> {
  const map = new Map<string, RawGroup>();
  // Teks opsi = isi sampai `</label>` (atau `<input>` berikutnya bila tanpa label).
  const re =
    /<input\b[^>]*type="radio"[^>]*name="([^"]+)"[^>]*value="([^"]*)"[^>]*>([\s\S]*?)(?=<\s*\/label\s*>|<input|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const name = m[1]!;
    const val = m[2]!;
    const text = m[3]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!map.has(name)) map.set(name, { name, pos: m.index, end: m.index + m[0].length, opts: [] });
    map.get(name)!.opts.push({ val, text });
  }
  return map;
}

/**
 * Indeks `<ul>` yang BENAR-BENAR menaungi posisi `pos` (−1 bila tak ada).
 *
 * Bukan sekadar "`<ul>` terakhir sebelum pos" — harus dipastikan belum ada
 * `</ul>` di antaranya. Tanpa ini, `<ul>` jauh di awal artikel akan dianggap
 * menaungi semua radio berikutnya (temuan PAS/SAS: jarak >21.000 karakter).
 */
function enclosingUl(html: string, pos: number, ulPositions: number[]): number {
  const candidates = ulPositions
    .map((start, i) => ({ start, i }))
    .filter((c) => c.start < pos);
  if (candidates.length === 0) return -1;
  const last = candidates[candidates.length - 1]!;
  const closeIdx = html.indexOf("</ul>", last.start);
  if (closeIdx === -1) return last.i;
  return closeIdx < pos ? -1 : last.i;
}

/** Grup radio benar-salah (tepat 2 opsi Benar/Salah). */
function isTrueFalse(g: RawGroup): boolean {
  if (g.opts.length !== 2) return false;
  return g.opts.every((o) => asBenarSalah(o.text) !== null);
}

export interface TrueFalseRow {
  text: string;
  answer: string | null;
}

export interface TrueFalseQuestion {
  /** Nama grup pertama (untuk penomoran stabil). */
  firstGroup: string;
  /** Indeks `<ul>` yang menaungi pernyataan ini (−1 bila tak ada). */
  ulIndex: number;
  stem: string;
  rows: TrueFalseRow[];
  hasKey: boolean;
  /** Pembahasan (`<details>` setelah blok soal) bila ada. */
  explanation?: string;
}

/**
 * Pembahasan milik satu blok BS: `<details>` pertama SETELAH blok ini, tetapi
 * sebelum blok soal berikutnya.
 *
 * Temuan TKA: beberapa grup BS ada dalam satu `<ul>`, dan `<details>` ada
 * setelah `</ul>` — blok soal harus dibaca sampai penutupnya, bukan sampai
 * radio berikutnya.
 */
function explanationAfterBlock(html: string, blockIndex: number, blocks: number[]): string | undefined {
  const start = blocks[blockIndex];
  if (start === undefined) return undefined;
  const nextStart = blocks[blockIndex + 1] ?? html.length;
  const det = html.indexOf("<details", start);
  if (det === -1 || det > nextStart) return undefined;
  const end = html.indexOf("</details>", det);
  if (end === -1) return undefined;
  const inner = html
    .slice(det, end + "</details>".length)
    .replace(/<details\b[^>]*>/i, "")
    .replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/i, "");
  const text = cleanHtml(inner).text.trim();
  return text || undefined;
}

/** Stem: teks dari pembuka blok (`<h4>`/`<blockquote>`) sampai sebelum `<ul>`. */
function stemForUl(html: string, ulStart: number): string {
  const back = html.slice(0, ulStart);
  const opens = [
    back.lastIndexOf("<blockquote"),
    back.lastIndexOf("<h4"),
    back.lastIndexOf("<h3"),
  ].filter((i) => i !== -1);
  const start = opens.length ? Math.max(...opens) : Math.max(0, ulStart - 1200);
  const raw = html.slice(start, ulStart).replace(/<\/?div\b[^>]*>/gi, " ");
  const cleaned = cleanHtml(raw).text.replace(/\s+/g, " ").trim();
  // Rapikan kalimat penutup agar konsisten.
  return cleaned.replace(/tentukan apakah setiap pernyataan berikut[\s\S]*$/i, "").trim();
}

/**
 * Kumpulkan SELURUH soal benar-salah di artikel.
 *
 * Dua bentuk sumber yang terverifikasi:
 *   1. **Per-`<ul>`** (TKA): pernyataan dalam satu `<ul>`, satu `<ul>` = satu soal.
 *   2. **Per-`<h4>`** (PAS/SAS): satu soal = satu `<h4>` + `<blockquote>` berisi
 *      satu pernyataan.
 *
 * Pengelompokan memakai batas blok; bila batas tak dapat ditentukan, jawab `[]`
 * (jangan menebak — lebih baik tak menangani daripada salah gabung).
 */
export function collectTrueFalseQuestions(html: string): TrueFalseQuestion[] {
  const groups = collectRawGroups(html);
  const ulPositions = [...html.matchAll(/<ul\b[^>]*>/gi)].map((m) => m.index!);
  const h4Positions = [...html.matchAll(/<h4\b[^>]*>/gi)].map((m) => m.index!);

  const bsGroups: { g: RawGroup; ulIndex: number; h4Index: number }[] = [];
  for (const g of groups.values()) {
    if (!isTrueFalse(g)) continue;
    bsGroups.push({
      g,
      ulIndex: enclosingUl(html, g.pos, ulPositions),
      h4Index: h4Positions.filter((h) => h < g.pos).length - 1,
    });
  }
  if (bsGroups.length === 0) return [];

  // Pilih kunci pengelompokan: pakai `<ul>` HANYA bila tiap pernyataan BS
  // benar-benar berada di dalam `<ul>` yang sama (bentuk TKA). Kalau ada satu
  // saja yang di luar `<ul>`, pakai `<h4>` (bentuk PAS/SAS) — agar `<ul>` milik
  // soal lain tidak menelan semua BS.
  const allInsideUl = bsGroups.every((b) => b.ulIndex >= 0);
  const sameUlCount = new Set(bsGroups.map((b) => b.ulIndex)).size;
  const useUl = allInsideUl && sameUlCount < bsGroups.length;
  const keyOf = (b: { ulIndex: number; h4Index: number }): number =>
    useUl ? b.ulIndex : b.h4Index;

  const byBlock = new Map<number, typeof bsGroups>();
  for (const item of bsGroups) {
    const k = keyOf(item);
    if (!byBlock.has(k)) byBlock.set(k, []);
    byBlock.get(k)!.push(item);
  }

  const out: TrueFalseQuestion[] = [];
  for (const [blockIndex, list] of [...byBlock.entries()].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => a.g.pos - b.g.pos);
    const rows: TrueFalseRow[] = [];
    for (const { g } of list) {
      // Pernyataan = `<li>` terdekat; tanpa `<li>`, pakai blok sebelum radio
      // (mis. `<div class="box white">pernyataan</div>`).
      const liStart = html.lastIndexOf("<li", g.pos);
      const stmtHtml =
        liStart !== -1 && liStart > g.pos - 2000
          ? html.slice(liStart, g.pos)
          : statementBefore(html, g.pos);
      const stmt = cleanHtml(stmtHtml.replace(/<\/?(?:div|span|button)\b[^>]*>/gi, " "))
        .text.replace(/\s+/g, " ")
        .trim();
      const key = g.opts.find((o) => CORRECT_VALUES.includes(o.val.trim().toLowerCase()));
      const answer = key ? asBenarSalah(key.text) : null;
      // Pernyataan bisa berupa GAMBAR (temuan TKA SD 2026): teks kosong tapi ada
      // `<img>` di dalam `<li>`. Pakai markdown gambar agar row tetap masuk dan
      // medianya ikut diunduh pipeline.
      const text = stmt || imageMarkdownInLi(html, g.pos);
      if (text) rows.push({ text, answer });
    }
    if (rows.length === 0) continue;
    const blockStart = useUl ? ulPositions[blockIndex] : h4Positions[blockIndex];
    out.push({
      firstGroup: list[0]!.g.name,
      ulIndex: blockIndex,
      stem: blockStart !== undefined ? stemForUl(html, blockStart) : "",
      rows,
      hasKey: rows.some((r) => r.answer !== null),
      explanation: explanationAfterBlock(html, blockIndex, useUl ? ulPositions : h4Positions),
    });
  }
  return out;
}

/**
 * Pernyataan untuk bentuk tanpa `<li>`: blok teks terakhir sebelum radio,
 * dibatasi pembuka soal (`<h4>`/`<blockquote>`) agar tak menyerap soal lain.
 */
function statementBefore(html: string, pos: number): string {
  const back = html.slice(0, pos);
  const opens = [
    back.lastIndexOf("<blockquote"),
    back.lastIndexOf("<h4"),
    back.lastIndexOf("<h3"),
  ].filter((i) => i !== -1);
  const start = opens.length ? Math.max(...opens) : Math.max(0, pos - 800);
  // Buang kalimat instruksi & sisa tag; ambil teksnya.
  return html.slice(start, pos).replace(/Tentukan Benar atau Salah[\s\S]*?[:.]/i, " ");
}

/**
 * Markdown gambar di dalam `<li>` yang memuat posisi `pos` (pernyataan bergambar).
 *
 * Mengembalikan gabungan `![alt](src)` untuk `<img>` di `<li>` tersebut; `""`
 * bila tak ada. Dipakai saat teks pernyataan kosong (soal BS berbasis gambar).
 */
function imageMarkdownInLi(html: string, pos: number): string {
  const liStart = html.lastIndexOf("<li", pos);
  if (liStart === -1) return "";
  const liEnd = html.indexOf("</li>", pos);
  const block = html.slice(liStart, liEnd === -1 ? pos + 3000 : liEnd);
  const parts: string[] = [];
  for (const m of block.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    const src = tag.match(/\bdata-src="([^"]+)"/i)?.[1] ?? tag.match(/\bsrc="([^"]+)"/i)?.[1];
    if (!src) continue;
    // Lewati placeholder kosong (data:image/... base64 1px dari lazy-load).
    if (/^data:image\//i.test(src)) continue;
    const alt = tag.match(/\balt="([^"]*)"/i)?.[1] ?? "Gambar";
    parts.push(`![${alt}](${src})`);
  }
  return parts.join(" ").trim();
}

/** Bangun `ParsedItem` matrix_grid dari satu soal benar-salah. */
export function buildTrueFalseItem(q: TrueFalseQuestion, index: number): ParsedItem {
  const warnings = q.hasKey ? [] : ["Sebagian pernyataan tanpa kunci di sumber — perlu telaah"];
  const stem =
    q.stem && q.stem.length > 0
      ? `${q.stem} Tentukan Benar atau Salah untuk setiap pernyataan berikut!`
      : "Tentukan Benar atau Salah untuk setiap pernyataan berikut!";
  return finalizeItem(stem, [], [], q.explanation, { index, heading: undefined }, warnings, {
    type: "matrix_grid",
    dataPayload: { labels: ["Benar", "Salah"], rows: q.rows },
  });
}

/** Nama grup yang sudah ditangani sebagai BS (agar dilewati jalur PG). */
export function trueFalseGroupNames(html: string): Set<string> {
  const names = new Set<string>();
  const groups = collectRawGroups(html);
  for (const g of groups.values()) if (isTrueFalse(g)) names.add(g.name);
  return names;
}
