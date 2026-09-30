/**
 * Adapter mathcyber (M9).
 *
 * Struktur (temuan langsung):
 *   <h2>…<span>Soal Nomor 1</span></h2>       ← awal soal (ID) / "Problem Number N" (EN)
 *   <p>…stem…<img>…</p>
 *   <ol style="list-style-type: upper-alpha"><li>opsi A</li>…</ol>   ← opsi (bila objektif)
 *   <div class="sp-wrap …">
 *     <div class="sp-head">Pembahasan</div>
 *     <div class="sp-body folded">…pembahasan…</div>   ← pembahasan
 *   </div>
 *
 * **Kunci**: tak ada atribut khusus; diekstrak dari pembahasan — pola
 *   `(Jawaban X)` (51%) atau `\boxed{…}` (58%). Bila tak ada → kosong + catatan.
 */
import { cleanHtml } from "../clean";
import { finalizeItem } from "../items";
import type { ArticleAdapter, ParsedItem, SegmentResult } from "../types";

/** Penanda awal soal (dua bahasa). */
const HEADING_RE = /(?:Soal Nomor|Problem Number)\s*(\d+)/i;

export const mathcyberAdapter: ArticleAdapter = (rawHtml): SegmentResult => {
  const items: ParsedItem[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  // Pecah pada penanda judul soal; ambil potongan setelah tiap penanda.
  const parts = rawHtml.split(new RegExp(`(?=${HEADING_RE.source})`, "i"));
  const blocks = parts.filter((p) => HEADING_RE.test(p));
  if (blocks.length === 0) {
    return { items: [], skipped: 0, warnings: ["Tak ada penanda 'Soal Nomor'/'Problem Number' (artikel)"] };
  }

  blocks.forEach((block, idx) => {
    const heading = block.match(HEADING_RE)?.[0];
    // Batasi blok s/d soal berikutnya sudah dipisah oleh split.
    const before = block;

    // OPSI — dua format: (a) <ol upper-alpha>, (b) inline "A. … B. … C. …".
    let opts: { label?: string; text: string }[] = [];
    const ol = before.match(/<ol[^>]*list-style-type:\s*upper-alpha[^>]*>([\s\S]*?)<\/ol>/i);
    if (ol) {
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let lm: RegExpExecArray | null;
      while ((lm = liRe.exec(ol[1]!)) !== null) {
        const text = cleanHtml(lm[1]!).text;
        if (text) opts.push({ text });
      }
    }

    // STEM = blok tanpa opsi & tanpa pembahasan.
    let stemSource = before;
    if (ol) stemSource = stemSource.replace(ol[0], " ");
    // buang div sp-wrap (pembahasan) dari stem
    stemSource = stemSource.replace(/<div class="sp-wrap[\s\S]*$/i, " ");
    let stem = cleanHtml(stemSource).text.replace(new RegExp(HEADING_RE.source, "i"), "").trim();

    // (b) Opsi inline: bila belum ada opsi, coba deteksi "A. … B. … C. …" di stem.
    if (opts.length === 0) {
      const inline = parseInlineOptions(stem);
      if (inline.options.length >= 2) {
        opts = inline.options;
        stem = inline.stem;
      }
    }

    // PEMBAHASAN dari sp-body (atau sp-wrap).
    const bodyRaw = matchBlock(before, "sp-body") ?? matchBlock(before, "sp-wrap");
    const explanation = bodyRaw ? cleanHtml(bodyRaw).text : undefined;

    // KUNCI dari pembahasan: "(Jawaban X)" lalu "\boxed{…}".
    const correct = extractKey(before);

    if (!stem) {
      skipped++;
      return;
    }

    items.push(finalizeItem(stem, opts, correct, explanation, { index: idx + 1, heading }, []));
  });

  return { items, skipped, warnings };
};

/**
 * Deteksi opsi **inline** `A. … B. … C. … D. …` (termasuk tata letak **2-kolom**
 * yang dipisah `<br>`/`&nbsp;`, mis. urutan tampil A-D-B-E-C).
 * Mengembalikan stem (tanpa opsi) + opsi **terurut menurut label**.
 */
function parseInlineOptions(text: string): { stem: string; options: { label: string; text: string }[] } {
  const labelRe = /(?:^|[\s\u00a0>])([A-E])\.\s/g;
  const marks: { label: string; start: number; end: number }[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = labelRe.exec(text)) !== null) {
    const label = m[1]!.toUpperCase();
    if (seen.has(label)) continue; // label ganda → ambil kemunculan pertama
    seen.add(label);
    // posisi label (lewati spasi/> di depan)
    const prefix = m[0].length - m[0].replace(/^[\s\u00a0>]+/, "").length;
    marks.push({ label, start: m.index + prefix, end: m.index + m[0].length });
  }
  // Butuh setidaknya A, B, C untuk dianggap sebagai daftar opsi.
  if (!(seen.has("A") && seen.has("B") && seen.has("C"))) return { stem: text, options: [] };

  // Urutkan mark berdasarkan posisi di teks (untuk memotong isi antar-label).
  const byPos = [...marks].sort((a, b) => a.start - b.start);
  const stem = text.slice(0, byPos[0]!.start).trim();

  // Isi tiap opsi = teks antara label ini dan label berikutnya (menurut posisi).
  const withText = byPos.map((mk, i) => {
    const from = mk.end;
    const to = i + 1 < byPos.length ? byPos[i + 1]!.start : text.length;
    return { label: mk.label, text: text.slice(from, to).replace(/[\u00a0\s]+/g, " ").trim() };
  });

  // Urutkan hasil menurut label (A, B, C, ...).
  const order = ["A", "B", "C", "D", "E"];
  const options = withText
    .filter((o) => o.text.length > 0)
    .sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));

  return { stem, options };
}

/** Ekstrak label kunci dari pola `(Jawaban X)`. */
function extractKey(html: string): string[] {
  const m = html.match(/\(Jawaban\s*([A-H])\)/i);
  if (m) return [m[1]!.toUpperCase()];
  return [];
}

/** Ambil isi <div class="X">…</div> (penutup pertama). */
function matchBlock(html: string, cls: string): string | null {
  const re = new RegExp(`<div class="[^"]*\\b${cls}\\b[^"]*"[^>]*>`, "i");
  const m = re.exec(html);
  if (!m) return null;
  const after = html.slice(m.index + m[0].length);
  const close = after.indexOf("</div>");
  return close === -1 ? after : after.slice(0, close);
}
