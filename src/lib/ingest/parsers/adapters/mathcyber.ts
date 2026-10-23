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
import { perbaikanKhususMathcyber } from "./mathcyber-khusus";

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

    // ⚠️ PENTING: buang SELURUH blok pembahasan lebih dulu.
    //
    // Struktur mathcyber: stem+opsi, lalu `<div class="sp-head">Pembahasan</div>`,
    // lalu `<div class="sp-body folded">…</div>`. Bila blok ini TIDAK dibuang
    // sebelum parsing opsi, teks pembahasan ikut terbaca sebagai opsi terakhir
    // (nyata: opsi D menelan seluruh pembahasan + "(Jawaban D)").
    // ⚠️ Versi lama hanya membuang `sp-wrap` → `sp-head`/`sp-body` lolos.
    const pembahasanRe = /<div class="sp-(?:head|body|wrap)[^"]*"[\s\S]*$/i;
    const tanpaBahas = before.replace(pembahasanRe, " ");
    // ⚠️ `before` TETAP dipakai untuk ekstraksi KUNCI (pola "(Jawaban X)" ada di
    // dalam sp-body) dan untuk PEMBAHASAN itu sendiri.

    // OPSI — dua format: (a) <ol upper-alpha>, (b) inline "A. … B. … C. …".
    let opts: { label?: string; text: string }[] = [];
    const ol = tanpaBahas.match(/<ol[^>]*list-style-type:\s*upper-alpha[^>]*>([\s\S]*?)<\/ol>/i);
    if (ol) {
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let lm: RegExpExecArray | null;
      while ((lm = liRe.exec(ol[1]!)) !== null) {
        const text = perbaikanKhususMathcyber(cleanHtml(lm[1]!).text);
        if (text) opts.push({ text });
      }
    }

    // STEM = blok tanpa opsi & tanpa pembahasan.
    let stemSource = tanpaBahas;
    if (ol) stemSource = stemSource.replace(ol[0], " ");
    let stem = cleanHtml(stemSource).text.replace(new RegExp(HEADING_RE.source, "i"), "").trim();
    // ⚠️ Perbaikan SPESIFIK mathcyber (kasus unik, tak layak aturan umum) —
    // lihat `mathcyber-khusus.ts` & `docs/plans/perbaikan-manual-mathcyber.md`.
    stem = perbaikanKhususMathcyber(stem);

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
    const explanation = bodyRaw ? perbaikanKhususMathcyber(cleanHtml(bodyRaw).text) : undefined;

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

/**
 * Ekstrak label kunci dari pembahasan — **empat pola, dua bahasa**.
 *
 * Bentuk yang ditemukan langsung di korpus (2026-10-02):
 *
 * | Sumber | Pola | Jml |
 * |---|---|---|
 * | mathcyber (ID) | `(Jawaban E)` | utama |
 * | trigonometri (EN) | `(Answer B)` | 47 |
 * | arithmetic-* (EN) | `(Answer X)` | 47 |
 * | beaver (EN) | `The true answer is **option B**` | 29 |
 *
 * **Urutan pengecekan penting**: `(Jawaban|Answer) X` diperiksa lebih dulu
 * karena ia **tegas** (tanda kurung). `option X` diperiksa **terakhir** dan
 * hanya bila didahului `answer`/`correct`, sebab di artikel beaver frasa
 * "shown in Option A" juga muncul saat **menjelaskan** opsi, bukan kunci.
 */
function extractKey(html: string): string[] {
  // 1. Paling tegas & paling umum: `(Jawaban X)` / `(Answer X)`.
  const paren = html.match(/\((?:Jawaban|Answer)\s*:?\s*([A-H])\)/i);
  if (paren) return [paren[1]!.toUpperCase()];

  // 2. Tanpa kurung, tapi dengan pemisah jelas: `Answer: B`, `Jawaban B`.
  const bare = html.match(/\b(?:Jawaban|Answer)\s*:?\s*([A-H])\b/i);
  if (bare) return [bare[1]!.toUpperCase()];

  // 3. `\boxed{A}` — LaTeX pada pembahasan (bukan jawaban panjang).
  const boxed = html.match(/\\boxed\s*\{\s*(?:\\text\s*\{\s*)?([A-H])\s*\}?\s*\}/i);
  if (boxed) return [boxed[1]!.toUpperCase()];

  // 4. Paling lemah — WAJIB didahului kata pemicu yang menandakan PILIHAN.
  //
  // ⚠️ Tag HTML harus DIBUANG lebih dulu: korpus menulis
  //    `The true answer is <strong>option B.` — dengan penanda tag, regex
  //    yang melarang `<`/`>` tak akan pernah cocok.
  //
  // ⚠️ Pemicu sengaja DIBATASI. Di artikel beaver, `option` muncul dalam dua
  //    makna — dan hanya yang pertama itu kunci:
  //      ✅ `You should choose option D` · `The true answer is option B`
  //      ❌ `the one shown in Option A` (menjelaskan, BUKAN kunci)
  //    Karena itu `shown in` TIDAK masuk daftar pemicu.
  const text = html.replace(/<[^>]*>/g, " ");
  const option = text.match(
    /\b(?:answer|correct|choose|choose\s+the|pilih|kunci|jawaban)\b[^.!?]{0,40}?\boption\s+([A-H])\b/i,
  );
  if (option) return [option[1]!.toUpperCase()];

  return [];
}

/**
 * Ambil isi `<div class="X">…</div>` dengan **kedalaman `<div>` dihitung**.
 *
 * ⚠️ Versi lama memakai `indexOf("</div>")` PERTAMA — salah bila isi blok
 * memuat `<div>` bersarang (nyata: `.sp-body` berisi `<div class="spdiv">…`
 * sehingga terpotong DI TENGAH rumus `\boxed{…}` → KaTeX "Unexpected end of
 * input in a macro argument"). Sekarang: telusuri tag `<div>`/`</div>` dan
 * berhenti saat kedalaman kembali 0.
 */
function matchBlock(html: string, cls: string): string | null {
  const re = new RegExp(`<div class="[^"]*\\b${cls}\\b[^"]*"[^>]*>`, "i");
  const m = re.exec(html);
  if (!m) return null;
  const after = html.slice(m.index + m[0].length);
  const tagRe = /<div\b[^>]*>|<\/div>/gi;
  let depth = 0;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(after)) !== null) {
    if (tm[0].startsWith("</")) {
      if (depth === 0) return after.slice(0, tm.index);
      depth--;
    } else {
      depth++;
    }
  }
  return after;
}
