/**
 * Cleaning korpus (M9) — **fungsi murni** (L6: tanpa DB, tanpa network).
 *
 * Aturan general untuk SEMUA sumber korpus (mathcyber · m4thlab · defantri ·
 * pusmendik): ubah HTML artikel hasil crawl → teks bersih + math ternormalisasi.
 *
 * ⚠️ URUTAN PENTING (lihat `docs/ATURAN-CLEANING-KORPUS.md`):
 *   buang blok → struktur→markdown → sisa tag → **entitas** → spasi → shortcode → math.
 *   Entitas HARUS di-decode SEBELUM normalisasi math, agar `&amp;` di dalam
 *   `\begin{aligned} … &amp; = …` menjadi `&` (perataan `&=`), bukan teks "&amp;".
 *
 * Keputusan user (2026-09-30, hasil evaluasi 1.081 file):
 *   - Shortcode = **daftar-hitam** ([collapse],[spoiler]) — BUKAN buang-semua `[a-z]`
 *     (mis. `[n]`,`[m]` adalah LaTeX — buang-semua akan MERUSAK matematika).
 *   - `<table>` **dipertahankan** HTML (dan `<br>` di dalamnya dibiarkan `<br>`).
 *   - `<pre>`/`<code>`/`<hr>` **dibuang** (kode fungsi/sampah JS — bukan soal).
 *   - **`<blockquote>` JANGAN dibuang** — terbukti 9.740 = pembungkus SOAL; tag dilepas.
 *   - `<ul>/<ol>/<li>` → daftar markdown **dengan indentasi sarang**.
 *   - `<figcaption>` → caption markdown; `<svg>` diagram dipertahankan, ikon dibuang.
 *   - `stripTags` **melindungi math** (mis. `$x<3$`) sebelum buang tag (Opsi C).
 */
import { repairAdaptive } from "./katex-repair";

/** Nama shortcode yang dibuang (daftar-hitam). Lihat EVALUASI-KORPUS-KOMPREHENSIF. */
const DROP_SHORTCODES = ["collapse", "spoiler"] as const;
/** Blok yang isinya dibuang total (beserta tag-nya). */
const DROP_BLOCKS =
  /<(script|style|noscript|iframe|form|button|ins|nav|aside|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi;

/**
 * `<svg>` yang merupakan **ikon UI** (kecil, `width`/`height` ≤ 32 atau viewBox
 * `0 0 24 24`) — dibuang. Diagram/grafik bermakna (viewBox lebar, banyak
 * `<line>`/`<polygon>`) **dipertahankan** (temuan: 3 SVG grafik fungsi di m4thlab).
 */
const SVG_ICON = /<svg\b[^>]*>[\s\S]*?<\/svg>/gi;

/** Blok yang isinya KOSONG (tag pembuka saja, tanpa pasangan). */
const DROP_EMPTY_BLOCKS = /<(?:link|meta|source|track|wbr|area|col)\b[^>]*>/gi;

/** Komentar HTML. */
const HTML_COMMENT = /<!--[\s\S]*?-->/g;

/** Pembungkus iklan AdSense: <div class="<hash>">…</div> yang memuat penanda iklan. */
const ADSENSE_DIV =
  /<div\b[^>]*class="[0-9a-f]{16,}"[^>]*>[\s\S]{0,800}?(?:adsbygoogle|googlesyndication|pagead)[\s\S]*?<\/div>/gi;

/** Sisa penanda iklan yang lolos (tanpa tag pembungkus). */
const ADSENSE_LEFTOVER = /(?:<script[^>]*googlesyndication[^>]*>[\s\S]*?<\/script>)/gi;

/**
 * Entitas HTML bernama → karakter. Cakupan umum di korpus.
 * (`&amp;` → `&`; penting untuk LaTeX `&=`.)
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  // Spasi lebar → spasi biasa (dirapikan lagi oleh normalizeWhitespace).
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  times: "×",
  divide: "÷",
  minus: "−",
  deg: "°",
  ordm: "º",
  middot: "·",
  laquo: "«",
  raquo: "»",
  copy: "©",
  reg: "®",
  trade: "™",
  prime: "′",
  Prime: "″",
  sup2: "²",
  sup3: "³",
  fnof: "ƒ",
  ang: "∠",
  pi: "π",
  larr: "←",
  rarr: "→",
  harr: "↔",
  infin: "∞",
  sum: "∑",
  prod: "∏",
  radic: "√",
  ne: "≠",
  le: "≤",
  ge: "≥",
  there4: "∴",
  isin: "∈",
  notin: "∉",
  empty: "∅",
  sub: "⊂",
  cup: "∪",
  cap: "∩",
};

/** Decode entitas HTML: &#nnn; · &#xhh; · &named; */
export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (m, name) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : m,
    );
}

/** Konversi kode titik aman (abaikan rentang surrogate/tak valid). */
function safeCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return "";
  if (cp >= 0xd800 && cp <= 0xdfff) return "";
  try {
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}

/**
 * Buang blok yang tak berguna: script/style/noscript/iframe/form/button/ins/nav/
 * aside/footer/header (beserta isinya), komentar HTML, iklan AdSense, dan
 * boilerplate situs. `<svg>` ikon dibuang, `<svg>` diagram **dipertahankan**.
 */
export function stripNoiseBlocks(html: string): string {
  let s = html;
  s = s.replace(HTML_COMMENT, "");
  s = s.replace(ADSENSE_DIV, "");
  s = s.replace(ADSENSE_LEFTOVER, "");
  // SVG: buang HANYA yang ikon kecil; diagram bermakna dibiarkan.
  s = s.replace(SVG_ICON, (tag) => (isSvgIcon(tag) ? "" : tag));
  s = s.replace(DROP_BLOCKS, "");
  s = s.replace(DROP_EMPTY_BLOCKS, "");
  return s;
}

/**
 * Apakah `<svg>` ini ikon UI (buang) atau diagram (pertahankan)?
 * Ikon: dimensi kecil (≤ 32) atau viewBox kotak 24×24, sedikit elemen.
 * Diagram: viewBox besar/tidak kotak-24, atau banyak `<line>`/`<polygon>`/`<path>`.
 */
export function isSvgIcon(svg: string): boolean {
  const open = svg.slice(0, svg.indexOf(">") + 1);
  const w = open.match(/width=["']?(\d+(?:\.\d+)?)/i);
  const h = open.match(/height=["']?(\d+(?:\.\d+)?)/i);
  const vb = open.match(/viewBox=["']([^"']+)["']/i);

  if ((w && parseFloat(w[1]!) > 32) || (h && parseFloat(h[1]!) > 32)) return false;

  if (vb) {
    const nums = vb[1]!.trim().split(/[\s,]+/).map(Number);
    if (nums.length === 4) {
      const [, , vw, vh] = nums;
      // viewBox "0 0 24 24" khas ikon → buang
      if (vw! <= 32 && vh! <= 32) return true;
      // viewBox besar (mis. "-130 -130 260 260") → diagram → pertahankan
      if (vw! > 64 || vh! > 64) return false;
    }
  }

  // Banyak elemen gambar (garis/poligon/kurva) → diagram.
  const shapes = (svg.match(/<(line|polygon|polyline|path|circle|rect|text)\b/gi) ?? []).length;
  if (shapes >= 5) return false;

  return true;
}

/** Buang shortcode daftar-hitam: [collapse] [/collapse] [spoiler] [/spoiler]. */
export function stripShortcodes(input: string): string {
  let s = input;
  for (const name of DROP_SHORTCODES) {
    s = s.replace(new RegExp(`\\[/?${name}[^\\]]*\\]`, "gi"), "");
  }
  return s;
}

/**
 * Ubah struktur HTML umum → markdown:
 *   `<br>` → \n (kecuali di dalam `<table>` — dibiarkan `<br>`) · `<li>` → "- "/"1. "
 *   (dengan **indentasi sarang**) · `<hr>`/`<pre>`/`<code>` → **dibuang** ·
 *   `<blockquote>` → **tag dilepas, isi tetap** (temuan: 9.740 blockquote = SOAL).
 * `<table>` DIPERTAHANKAN apa adanya.
 */
export function structureToMarkdown(html: string): string {
  let s = html;

  // <pre>/<code> dibuang (temuan: kode fungsi & sampah JS — bukan soal).
  s = s.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, " ");
  s = s.replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, " ");

  // <hr> dibuang (temuan: 0 blok — tak ada di korpus).
  s = s.replace(/<hr\b[^>]*>/gi, "\n");

  // <br> → newline, KECUALI di dalam <table> (HTML: \n tak menampilkan baris baru).
  s = s.replace(/<br\s*\/?>/gi, (br) => br.replace(/<br\s*\/?>/i, "<br/>"));
  // Lindungi <br> di dalam <table> agar tak ikut diubah di langkah berikut.
  s = s.replace(/<table\b[\s\S]*?<\/table>/gi, (table) => table.replace(/<br\/>/gi, "\u0001"));
  // Sisa <br> (di luar table) → newline
  s = s.replace(/<br\s*\/?>/gi, "\n");
  // Kembalikan <br> di dalam table
  s = s.replace(/\u0001/g, "<br/>");

  // TABEL → markdown pipe.
  // ⚠️ WAJIB: tanpa ini `<td>`/`<tr>` lolos ke `stripTags`; bila tag itu berada
  // di dalam area math yang disembunyikan, ia TAK ikut dibersihkan → KaTeX
  // "jebol" (bug korpus nyata: soal Program Linear, solusi memuat `</td>`).
  s = s.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_table, inner: string) => renderTable(inner));

  // <p>/<div>/<section> → newline ganda agar blok alinea terpisah bersih
  s = s.replace(/<\/?(?:p|div|section)\b[^>]*>/gi, "\n\n");

  // <blockquote> → **tag dilepas, isi tetap** (temuan: 9.740 blockquote = SOAL).
  // Isi TIDAK boleh hilang; hanya pembungkusnya dibuang. Jangan dijadikan
  // tanda kutipan markdown (`>`) — akan mengacaukan teks soal.
  s = s.replace(/<\/?blockquote\b[^>]*>/gi, "\n\n");

  // <ol> → "1. ", <ul> → "- " (dengan indentasi sarang).
  // Proses DAFTAR TERDALAM dulu (loop) agar sarang tertangani bertahap.
  for (let pass = 0; pass < 8; pass++) {
    const before = s;
    s = s.replace(/<(ol|ul)\b[^>]*>((?:(?!<(?:ol|ul)\b)[\s\S])*?)<\/\1>/gi, (full, tag: string, inner: string) => {
      if (/<(?:ol|ul)\b/i.test(inner)) return full; // masih ada sarang → tunggu pass berikutnya
      return renderList(inner, tag.toLowerCase() === "ol");
    });
    if (s === before) break;
  }

  return s;
}

/**
 * Render ISI `<table>` menjadi markdown pipe.
 *
 * - Baris `<tr>` → `| sel | sel |`
 * - Bila baris pertama memakai `<th>` (atau semua baris `<th>`) → jadi header,
 *   diikuti baris pemisah `| --- | --- |`.
 * - Jumlah sel tak seragam → ditulis apa adanya (jangan sampai hilang).
 * - Isi sel dibersihkan tag inline-nya (math `$…$` DIBIARKAN utuh).
 */
function renderTable(inner: string): string {
  const rows: { cells: string[]; isHeader: boolean }[] = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(inner)) !== null) {
    const tr = m[1]!;
    const isHeader = /<th\b/i.test(tr);
    const cells: string[] = [];
    const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let c: RegExpExecArray | null;
    while ((c = cellRe.exec(tr)) !== null) {
      // Bersihkan tag inline dalam sel; math `$…$` tetap.
      const cell = c[1]!
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<\/?(?:span|b|strong|i|em|u|sub|sup|small|mark|a|abbr|cite|q|s|del|ins|kbd|var|samp|time|p|div)\b[^>]*>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\|/g, "\\|") // pipe di dalam sel harus di-escape
        .trim();
      cells.push(cell);
    }
    if (cells.length > 0) rows.push({ cells, isHeader });
  }
  if (rows.length === 0) return "\n";

  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  const out: string[] = [];
  const first = rows[0]!;
  const headerRow = first.isHeader || rows.every((r) => r.isHeader);
  if (headerRow) {
    out.push(line(first.cells));
    out.push(`| ${first.cells.map(() => "---").join(" | ")} |`);
    for (const r of rows.slice(1)) out.push(line(r.cells));
  } else {
    out.push(line(first.cells));
    out.push(`| ${first.cells.map(() => "---").join(" | ")} |`);
    for (const r of rows.slice(1)) out.push(line(r.cells));
  }
  return `\n${out.join("\n")}\n`;
}

/**
 * Render ISI `<ol>`/`<ul>` (sarang sudah dirender jadi teks markdown oleh pass
 * sebelumnya) menjadi daftar markdown; baris hasil sarang diberi **indentasi 2 spasi**.
 */
function renderList(inner: string, ordered: boolean): string {
  let i = 0;
  const lines: string[] = [];
  const liRe = /<li\b[^>]*>([\s\S]*?)(?=<\/li>|<li\b|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = liRe.exec(inner)) !== null) {
    const raw = m[1]!.trim();
    if (!raw) {
      if (ordered) i++;
      continue;
    }
    // Baris pertama = teks item; baris berikutnya = daftar sarang → indent 2 spasi.
    const parts = raw.split("\n");
    const head = stripTags(parts[0]!).trim();
    if (head) lines.push(`${ordered ? `${++i}. ` : "- "}${head}`);
    else if (ordered) i++;
    for (const extra of parts.slice(1)) {
      if (extra.trim()) lines.push(`  ${extra.trim()}`);
    }
  }
  return "\n" + lines.join("\n") + "\n";
}

/**
 * Pilih URL gambar terbaik dari tag `<img>` **tanpa** absolutisasi.
 *
 * `srcset` (kandidat terbesar) > `data-src`/`data-lazy-src` > `src`.
 * Alasan: `src` mathcyber = path crawler lama (**404**), URL asli ada di `srcset`.
 */
export function bestImageSrc(tag: string): string | undefined {
  const attr = (name: string): string | undefined => {
    const m = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"));
    return m ? m[1]!.trim() : undefined;
  };

  const srcset = attr("srcset");
  if (srcset) {
    let best: string | undefined;
    let bestScore = -1;
    for (const part of srcset.split(",")) {
      const m = part.trim().match(/^(\S+)\s*(?:(\d+)w|(\d+(?:\.\d+)?)x)?$/);
      if (!m) continue;
      const score = m[2] ? parseInt(m[2], 10) : m[3] ? Math.round(parseFloat(m[3]) * 1000) : 1;
      if (score > bestScore) {
        bestScore = score;
        best = m[1]!;
      }
    }
    if (best) return best;
  }
  for (const name of ["data-src", "data-lazy-src", "data-original"]) {
    const v = attr(name);
    if (v) return v;
  }
  return attr("src");
}

/** Ubah <img> → markdown, kembalikan sekaligus daftar URL gambar. */
export function extractImages(html: string): { text: string; media: string[] } {
  const media: string[] = [];
  let text = html.replace(/<img\b[^>]*>/gi, (tag) => {
    // Pilih URL terbaik: `srcset` (URL asli hidup) > lazy > `src`.
    // Absolutisasi dilakukan lapisan media (butuh URL artikel); di sini cukup
    // ambil kandidat mentahnya yang benar.
    const src = bestImageSrc(tag);
    if (!src) return "";
    if (!media.includes(src)) media.push(src);
    const alt = tag.match(/alt=["']([^"']*)["']/i);
    return `\n\n![${alt ? alt[1] : "Gambar"}](${src})\n\n`;
  });

  // <figcaption> → baris caption miring (temuan: 113 caption nyata).
  text = text.replace(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/gi, (_, inner) => {
    const cap = stripTags(inner).trim();
    return cap ? `\n\n*${cap}*\n\n` : "";
  });

  return { text, media };
}

/**
 * Buang tag HTML yang tersisa → spasi — **tanpa merusak matematika**.
 *
 * Temuan (65 file): pola naif `/<[^>]+>/` merusak math seperti `$x < 3$ dan $y > 2$`
 * (menganggap "< 3$ … $y >" sebagai tag). Solusi (Opsi C): **sembunyikan isi math**
 * lebih dulu (placeholder), buang tag, lalu kembalikan.
 */
export function stripTags(html: string): string {
  const store: string[] = [];
  const hide = (m: string) => `\u0000${store.push(m) - 1}\u0000`;

  let s = html;

  // Sembunyikan blok math ($$…$$ dan \[…\]) serta environment multiline ($...\begin{...}...\end...$) lebih dulu.
  // ⚠️ `$$…$$` / `\[…\]`: versi lama `[\s\S]+?` menyeberangi BARIS & TAG BLOK,
  // sehingga bisa menelan paragraf berikutnya (termasuk `<a href=…>` → tag itu
  // tersimpan di placeholder lalu dikembalikan UTUH → `<a>` bocor ke output).
  // Batasi: tak boleh memuat tag blok (`<p`/`</p`/`<div`/`<br`/`<li`/`<ul`) atau
  // `$$`/`$` telanjang — cukup sampai penutup terdekat pada blok yang sama.
  s = s.replace(/\$\$(?:(?!\$\$)[\s\S])*?\$\$|\\\[(?:(?!\\\]|<\/?(?:p|div|br|li|ul|ol|table|tr|td|th|blockquote)\b)[\s\S])*?\\\]/gi, hide);
  // ⚠️ `<a` (tag) dilarang di SEMUA pola hide: bila `<a href=…>` ikut tersembunyi
  // di placeholder, ia dikembalikan UTUH → tag bocor (bug nyata 43 soal).
  // `hide` hanya untuk RUMUS. Penanda `<a[\s>]` (bukan `<a` telanjang!) agar
  // math sah `$0<a<1$` TIDAK dianggap tag.
  s = s.replace(/\$((?:(?!\$|<a[\s>])[\s\S])*?\\(?:begin|end)\{[a-z*]+\}(?:(?!\$|<a[\s>])[\s\S])*?)\$/gi, hide);
  s = s.replace(/\$((?:(?!\$|<a[\s>])[^\n])*?)\$|\\\(((?:(?!\\\)|<a[\s>])[^)])*?)\\\)/g, hide);

  // ⚠️ LINK `<a …>…</a>` DIBUANG di sini — SETELAH math disembunyikan (placeholder)
  // dan SEBELUM tag lain dibuang. Dua alasan:
  //  1) `</a>` andal sebagai penanda: `<a>` selalu berpasangan (8.951 `<a>` vs
  //     8.950 `</a>` di korpus defantri) → teks jangkar dipertahankan, tag+atribut hilang.
  //  2) WAJIB setelah hide-math: kasus sah `$0<a<1$` (math memuat `<a`) tampak
  //     seperti tag `<a>` bila diproses lebih dulu → math rusak. Setelah hide,
  //     `<a>` semacam itu ada di dalam placeholder dan tak tersentuh.
  s = s.replace(/<[\s>][^>]*>([\s\S]*?)<\/a>/gi, "$1");
  s = s.replace(/<\/?a\b[^>]*>/gi, "");

  // Kini aman: buang semua tag.
  // ⚠️ Tag INLINE dibuang TANPA spasi — `<span>C</span>alon` harus jadi `Calon`,
  // bukan `C alon` (temuan nyata: drop-cap defantri `<span class="awal">C</span>alon`).
  // Tag blok/struktural tetap jadi spasi agar kata tidak menempel.
  const INLINE_TAG = /<\/?(?:span|b|strong|i|em|u|sub|sup|small|mark|a|abbr|cite|q|s|del|ins|kbd|var|samp|time)\b[^>]*>/gi;
  s = s.replace(INLINE_TAG, "");
  s = s.replace(/<[^>]+>/g, " ");

  // Kembalikan isi math — **iteratif**: placeholder bisa BERSARANG (mis.
  // sumber `$\int…+$$\int…$` → satu placeholder memuat placeholder lain),
  // sehingga satu pass menyisakan `\u0000`. Loop sampai stabil.
  let prev: string;
  do {
    prev = s;
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => store[Number(i)]!);
  } while (s !== prev && s.includes("\u0000"));

  // Jaring pengaman: bila masih ada `\u0000` yatim (store rusak), buang —
  // NUL akan ditolak PostgreSQL dan membuat soal hilang saat commit.
  s = s.replace(/\u0000/g, "");
  return s;
}

/** Rapikan spasi: \u00a0 → spasi, spasi ganda → 1, baris kosong > 2 → 1. */
export function normalizeWhitespace(input: string): string {
  return input
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Normalisasi penulisan matematika:
 *   `$$…$$` → `\[…\]`   (display)
 *   `$…$`   → `\(…\)`   (inline)
 * `\(…\)`/`\[…\]` yang sudah benar dibiarkan.
 * Mengembalikan juga `imbalanced` bila ditemukan `$` **yatim** (tak berpasangan).
 *
 * Deteksi dilakukan dengan pemindaian berurutan (bukan sekadar hitung): `$$` dulu
 * sebagai blok, lalu `$…$` berpasangan; sisa `$` tunggal = yatim. Ini lebih andal
 * daripada hitung jumlah `% 2` (satu `$` mata uang bisa mengacaukan paritas).
 */
export function normalizeMath(input: string): { text: string; imbalanced: boolean } {
  const imbalanced = hasOrphanDollar(input);

  let s = input;

  // ⚠️ BARIS BARU LITERAL (`\n` dua karakter) DI DALAM RUMUS — cacat NYATA.
  //
  // Sumber: `<br>` di dalam blok math diterjemahkan `structureToMarkdown`
  // menjadi `\n` DUA KARAKTER (bukan baris baru). `renderText` di klien HANYA
  // menyentuh token `kind:"text"` — token MATH dirender apa adanya lewat
  // `renderMath`, sehingga KaTeX menerima `\n` literal dan GAGAL:
  //   "Undefined control sequence: \n at position 16".
  // Diuji pada 8.229 soal DB: 17.522 galat, mayoritas pola ini.
  //
  // Perbaikan: buang `\n` literal (dan spasi sekitarnya) DI DALAM delimiter
  // math saja. Di luar math, `\n` literal memang pemisah baris biasa — JANGAN
  // disentuh. Pola `\\n` (baris baru LaTeX asli) TIDAK boleh ikut terhapus.
  s = s.replace(
    /(\\\[|\\\(|\$\$|\$)([\s\S]*?)(\\\]|\\\)|\$\$|\$)/g,
    (m, buka: string, isi: string, tutup: string) => {
      if (!/\\n/.test(isi)) return m;
      const bersih = isi.replace(/[ \t]*\\n[ \t]*/g, " ");
      return `${buka}${bersih}${tutup}`;
    },
  );

  // LABEL OPSI dulu: `$(A)$` / `$(A)\ … $` → `\((A)\)`-style sementara.
  // ⚠️ HARUS sebelum display `$$…$$`: pada `$(A)\ $$…$$` (soal matriks defantri),
  // regex display menang duluan dan menyisakan label mentah `$(A)\ ` →
  // label tak dikenali & kunci hilang. Pola label ini spesifik (huruf A–H
  // tunggal) sehingga aman dijalankan lebih awal.
  // ⚠️ Body label DILARANG memuat `\begin{`/`\end{`: kalau diizinkan, label
  // menelan matriks multi-baris & menutup `\)` di tempat salah → rusak
  // (`\((A)\ \begin{pmatrix}\)` — bug korpus nyata).
  s = s.replace(
    /(?<![\w$\\])\$\(\s*([A-H])\s*\)((?:(?!\\begin\{|\\end\{)[^$])*?)\$(?![\d$])/g,
    (_m, letter: string, rest: string) => `\\((${letter})${rest}\\)`,
  );
  // Varian label dengan penutup `$$` (typo sumber): `$(D)\ 2,\ 3,\ 9$$`
  // → label dibuang, `$$` sisa dirapikan agar tak jadi `\(…\)$`.
  s = s.replace(
    /(?<![\w$\\])\$\(\s*([A-H])\s*\)([^$\n]*?)\$\$/g,
    (_m, letter: string, rest: string) => `\\((${letter})${rest}\\)`,
  );
  // Varian label diikuti display: `$(A)\ $$…$$` → `\((A)\)` + `$$…$$`.
  s = s.replace(
    /(?<![\w$\\])\$\(\s*([A-H])\s*\)([^$\n]*?)\s*\$\$(?=[^$])/g,
    (_m, letter: string, rest: string) => `\\((${letter})${rest}\\)$$`,
  );
  // Varian label TANPA `$` penutup: `$(A)\ 63` (soal matriks; `$` penutup baru
  // muncul jauh di akhir). Hanya cocok bila setelah `$(A)` TIDAK ada `$` lagi
  // di baris itu. ⚠️ DILARANG memuat `\begin{`: bila diizinkan, pola ini menutup
  // `\)` di AKHIR BARIS → `\((A)\ \begin{pmatrix}\)` (rusak, bug korpus nyata).
  s = s.replace(
    /(?<![\w$\\])\$\(\s*([A-H])\s*\)((?:(?!\\begin\{)[^$\n])*)$/gm,
    (_m, letter: string, rest: string) => `\\((${letter})${rest}\\)`,
  );
  // ⚠️ CATATAN: pola `$…$$` (dolar bertumpuk) SENGAJA TIDAK ditangani di sini.
  // Sudah diuji: normalisasi otomatis MERUSAK display sah (`$$x^2$$` → `\(x^2\)`)
  // dan menghasilkan output kacau pada `$…\text{…}$$`. Presisi < 100% → sesuai
  // prinsip proyek, TIDAK dipakai. 119 kemunculan di 30 berkas defantri
  // dibiarkan (sisa `$` menganggur; tidak mengganggu render).
  // Lihat `docs/plans/2026-10-06-temuan-dolar-bertumpuk.md`.
  // ⚠️ DICOBA & DIBATALKAN: menormalkan `$$` cacat di tengah rumus
  // (`$13+11+$$1=94$`). Berhasil sebagian (12→7 kasus) TAPI gagal saat `$$`
  // diapi spasi di satu sisi (`$201.720.172.017$$ x$$…`), dan berisiko
  // menyentuh display sah. Presisi < 100% → sesuai prinsip proyek TIDAK dipakai.
  // Sisa 12 item / 5.862 (0,2%) DIBIARKAN & dilaporkan ke pemilik, bukan ditebak.
  // Lihat `docs/plans/2026-10-06-temuan-dolar-bertumpuk.md`.
  // ⚠️ Environment TELANJAR (tanpa `$`) — cacat sumber defantri.
  // Penulis sering menulis `\begin{align}…\end{align}` atau `\begin{pmatrix}…`
  // TANPA delimiter. Bila dibiarkan, langkah inline nanti membungkusnya jadi
  // `\(…\)` → KaTeX ERROR (`{align} can be used only in display mode`).
  // Karena itu WAJIB dibungkus DISPLAY `\[…\]`, dan DIJALANKAN SEBELUM langkah
  // inline. Hanya menyasar `\begin{…}` yang TIDAK diawali `$`/`\[`.
  // ⚠️ Lookbehind `(?<![\w$\\])` saja TIDAK CUKUP: pada `$X=\left ( \begin{matrix}…`
  // karakter sebelum `\begin` adalah SPASI (bukan `$`), sehingga aturan ini
  // salah membungkus `\[…\]` DI DALAM `$…$` yang sah → `\(…\[\begin{matrix}…\)`
  // (KaTeX: "Undefined control sequence: \[") — bug nyata artikel matriks.
  // Perbaikan: hanya bila `\begin` TIDAK berada di dalam `$…$` — dicek dengan
  // menghitung `$` sebelum posisi (ganjil = di dalam math → LEWATI).
  s = s.replace(
    /(?<![\w$\\])(\\begin\{(?:align|align\*|aligned|split|gather|gather\*|equation|equation\*|array|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases)\}[\s\S]*?\\end\{(?:align|align\*|aligned|split|gather|gather\*|equation|equation\*|array|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases)\})/gi,
    (m, body: string, offset: number, whole: string) => {
      // Hitung `$` tunggal sebelum `offset` (abaikan `$$`).
      const sebelum = whole.slice(0, offset).replace(/\$\$/g, "");
      if ((sebelum.match(/\$/g) ?? []).length % 2 === 1) return m; // di dalam $…$ → biarkan
      // ⚠️ JANGAN bungkus bila `\begin{env}` berada di DALAM argumen perintah
      // kotak/teks (`\boxed{…}`, `\fbox{…}`, `\text{…}`) — di sana env BUKAN
      // display terpisah. Tanpa ini: `$$\boxed{\begin{aligned}…\end{aligned}}$$`
      // → `\[\boxed{\[\begin{aligned}…\end{aligned}\]}\]` → KaTeX
      // "Unexpected end of input in a macro argument".
      const ekor = sebelum.slice(-200);
      if (/\\(?:boxed|fbox|text|mathrm|mbox)\s*\{[^{}]*$/i.test(ekor)) return m;
      return `\\[${body}\\]`;
    },
  );
  // Display multiline ber-environment ($…\begin{align}…\end{align}…$).
  //
  // ⚠️ DIJALANKAN SEBELUM `$$…$$`: kalau sesudah, `$$…\begin…\end…$$` sudah
  // jadi `\[…\begin…\end…\]`, dan regex ini lalu MEMINJAM `$` dari inline
  // sebelumnya (mis. `$6$`) → `$6\[` (bug korpus nyata, ribuan soal).
  // Body DILARANG memuat `$` MAUPUN `\[`/`\]` (yang sudah ber-delimiter bukan
  // milik pola ini). ⚠️ Tanda `[` BIASA (mis. `\left[ OBA \right]`, `[ABCD]`)
  // HARUS DIIZINKAN — dulu dilarang, akibatnya `$…\begin{align}[ABCD]…$` gagal
  // cocok lalu jatuh ke inline `\(…\)` → KaTeX: "{align} only in display mode".
  // ⚠️ Bagian penutup dibuat GREEDY (`[\s\S]*` untuk bagian setelah `\end{env}`
  // terakhir): bila satu `$…$` memuat DUA env (mis. `\begin{bmatrix}…\end{bmatrix}
  // \times \begin{bmatrix}…\end{bmatrix}`), non-greedy berhenti di `\end`
  // PERTAMA → sisa jadi inline `\(…\)` (bug korpus nyata, artikel matriks).
  // Greedy selama tak menyeberangi `$` aman karena bagian terakhir tak boleh
  // memuat `$`.
  s = s.replace(
    /(?<!\$)\$([ \t]*(?:(?!\$|\\\[|\\\])[\s\S])*?\\begin\s*\{[a-z*]+\}(?:(?!\$|\\\[|\\\])[\s\S])*?\\end\s*\{[a-z*]+\}(?:(?!\$|\\\[|\\\])[\s\S])*?)\$(?!\$)/gi,
    (_, body: string) => {
      // ⚠️ DILARANG menyisipkan `\[` bila `\begin{env}` berada di DALAM
      // `\boxed{…}` / `\text{…}` / `\fbox{…}` — di sana env BUKAN display
      // terpisah. Tanpa ini: `$$\boxed{\begin{aligned}…\end{aligned}}$$`
      // (sudah jadi `\[\boxed{…}\]`) disisipi `\[\]` LAGI di dalam `\boxed`
      // → `\boxed{\[\begin{aligned}…\end{aligned}\]}` → KaTeX
      // "Unexpected end of input in a macro argument".
      const sebelumBegin = body.slice(0, body.search(/\\begin\s*\{/i));
      // (a) `egin{env}` di dalam `oxed{…}`/`	ext{…}` yang BELUM ditutup.
      if (/\\(?:boxed|fbox|text|mathrm|mbox)\s*\{[^}]*$/i.test(sebelumBegin)) return `$${body}$`;
      // (b) `\[…\]` sudah ada di dalam — mis. akibat `$$…$$`→`\[…\]` yang
      //     dijalankan lebih dulu pada `$$oxed{\[?…` — jangan sisipkan lagi.
      if (/\\\[/.test(body)) return `$${body}$`;
      return `\\[${body}\\]`;
    },
  );
  // Display ($$…$$) — pembuka dijaga `(?<!\$)`/`(?!\$)` agar `$6$` disusul
  // `$$…$$` tidak menghasilkan `$$` palsu.
  s = s.replace(/(?<!\$)\$\$([\s\S]+?)\$\$(?!\$)/g, (_, body) => `\\[${body}\\]`);
  // Inline ($…$).
  // ⚠️ Tanda dolar UANG (`US$5.500`) BUKAN delimiter rumus: pembuka tak boleh
  // didahului huruf/angka, penutup tak boleh diikuti digit.
  // Body boleh berakhir spasi (`$(A)\ 63 $` lazim di defantri) — jangan
  // mensyaratkan karakter non-spasi, nanti label opsi gagal dikonversi.
  // ⚠️ Body BOLEH memuat newline: rumus `\begin{pmatrix}` sering ditulis
  // multi-baris (`$\begin{pmatrix}<br />a \\ b<br />\end{pmatrix}$`). Bila
  // newline dilarang, regex melewati penutup dekat dan MEMINJAM `$` jauh →
  // menelan teks antar-rumus (bug korpus nyata: `$…\(teks\)…$` bersarang).
  // Batas 400 char mencegah "pinjam" yang keterlaluan.
  //
  // CATATAN: `body` harus SAMA jumlah dolar — `[^$]` tetap dipakai (bukan
  // `[\s\S]`) supaya tidak menyeberangi `$` lain; yang diizinkan hanyalah \n.
  // Pola umum: `$…$` (boleh multi-baris agar rumus `\begin{pmatrix}` multi-baris
  // tidak "meminjam" `$` jauh).
  //
  // ⚠️ DICOBA & DIBATALKAN: menambahkan aturan pembuka "menempel kata"
  // (`dan$[ABCD]$`) → memicu 484 kasus baru (mis. `Limas $T.ABCD$ \(…\) ABCD$`
  // ikut tertangkap). Presisi < 100% → sesuai prinsip proyek TIDAK dipakai.
  // Sisa ~5 item dari 5.862 (0,09%) dibiarkan; lihat
  // `docs/plans/2026-10-06-temuan-dolar-menempel-kata.md`.
  s = s.replace(/(?<![\w$\\])\$([^$]{1,400}?)\$(?![\d$])/g, (_m, body) => {
    if (/\\\(|\\\)/.test(body)) return _m;
    return `\\(${body.trim()}\\)`;
  });

  // ⚠️ `\[`/`\]` BERSARANG di dalam inline `\(…\)` — cacat sumber.
  // Sumber menulis `\(|x|=\left\{\[\begin{matrix}…\end{matrix}\]\right.\)`;
  // karena sudah math-mode, `\[`/`\]` di situ BUKAN delimiter → KaTeX error
  // ("Undefined control sequence: \[", "Can't use function '\]'").
  //
  // ⚠️ `\[`/`\]` BERSARANG di dalam inline `\(…\)` — DIPINDAH ke `katex-repair.ts`
  // (`repairAdaptive`, perbaikan "bracket-dalam-inline") sebagai PERBAIKAN ADAPTIF
  // yang hanya dipicu bila KaTeX benar-benar mengeluh. Alasannya: sebagai aturan
  // TETAP ia menangkap `\(…\[…\]…\)` yang seharusnya jadi DISPLAY `\[…\]`
  // (mis. `$…\begin{array}…$`), sehingga merusak kasus yang benar.

  // ⚠️ `}^\!` (superscript tanpa argumen) — sintaks KaTeX TIDAK VALID.
  // Sumber menulis `{}^\negatif_space` → KaTeX: "Got function '\mskip' with no
  // arguments as superscript". Perbaikan: beri argumen `{\!}`.
  // Menyasar `}^` yang diikuti `\!`/`\,`/`\;`/`\:` TANPA `{`.
  s = s.replace(/\}\^\s*(\\[!,;:])/g, "}^{$1}");

  // ⚠️ ENV DISPLAY di dalam INLINE `\(…\)` → jadikan DISPLAY `\[…\]`.
  // Langkah inline (`$…$` → `\(…\)`) berjalan lebih dulu; bila isinya
  // `\begin{align|aligned|split|gather}` (env yang WAJIB display) maka `\(…\)`
  // melanggar KaTeX → ubah jadi `\[…\]`.
  //
  // ⚠️ `[^()]*` penting: jangan menyeberangi `)`, supaya dua inline berdampingan
  // tidak digabung. Beberapa varian lain sudah dicoba & GAGAL (lihat komentar
  // panjang di riwayat); versi ini paling stabil.
  s = s.replace(
    /\\\(([^()]*\\begin\{(?:align|align\*|aligned|split|gather|gather\*|equation|equation\*)\}[\s\S]*?\\end\{(?:align|align\*|aligned|split|gather|gather\*|equation|equation\*)\}[^()]*)\)/g,
    (_m, body: string) => `\\[${body}\\]`,
  );
  // ⚠️ CATATAN (jangan ulangi percobaan ini): menambahkan env matriks/array
  // (array|matrix|pmatrix|…) ke aturan di atas MENAIKKAN error 1→11, karena
  // `\begin{matrix}` sering muncul di dalam inline yang memang sah dan
  // pemisahannya menyeberangi batas rumus lain. Versi ini (align-family saja)
  // adalah yang paling stabil. Sisa ~1 kasus/357 soal dibiarkan & dilaporkan.

  // ⚠️ Dolar MENGGANGGUR tepat sebelum delimiter lain: `$ \[…\]` atau `$ \(…\)`.
  // Sumber menyisakan `$` sendirian (mis. setelah `\)` di baris sebelumnya);
  // `tokenizeMath` lalu memakai `$` itu sebagai inline opener → menelan `\[`
  // sehingga KaTeX error "Undefined control sequence: \[". Buang `$` yatim itu.
  s = s.replace(/(?<![\w$\\])\$\s*(?=\\\[|\\\()/g, "");
  s = s.replace(/(?<=\\\]|\\\))\s*\$(?![\d$])/g, "");

  // ⚠️ `\begin{array}` TANPA kolom-spec — cacat sumber.
  // `array` WAJIB diikuti `{…}` (mis. `{c}`, `{|c|c|}`); tanpa itu KaTeX:
  // "Expected node of symbol group type". Hanya menyasar yang TIDAK punya `{`.
  s = s.replace(/\\begin\{array\}(?!\s*\{)/g, "\\begin{array}{c}");

  // ⚠️ Delimiter KOSONG `\(\)` / `\[\]` — cacat sumber.
  // Sumber menyisakan `\(\)` (mis. `…\end{align}\]\(\)\therefore$`), KaTeX:
  // "Can't use function '\)' in math mode". Delimiter tanpa isi memang sia-sia.
  s = s.replace(/\\\(\\\)/g, "").replace(/\\\[\\\]/g, "");
  // `\)` YATIM (tanpa `\(` pembuka sejenis sebelum-nya) → buang.
  {
    const opens = (s.match(/\\\(/g) ?? []).length;
    const closes = (s.match(/\\\)/g) ?? []).length;
    if (closes > opens) {
      let sisa = closes - opens;
      // Buang dari KANAN (biasanya sisa di ujung).
      s = [...s].reverse().join("").replace(/\\\)((?:(?!\\\(|\\\)).)*)/g, (_m: string, rest: string) => {
        if (sisa <= 0) return _m;
        sisa--;
        return rest;
      });
      s = [...s].reverse().join("");
    }
  }

  // ⚠️ Typo KaTeX nyata di sumber (menghentikan render).
  // 1) `pi` tanpa backslash (`\dfrac{1}{3} pi r^{2}`) → KaTeX: "Expected & or \\".
  //    Hanya bila `pi` berdiri sebagai kata (didahului spasi, diikuti spasi/^{).
  s = s.replace(/(?<=[\s\d}])pi(?=[\s^{])/g, "\\pi");
  // 2) `\text{_}` (underscore telanjang) → `\text{\_}`.
  s = s.replace(/\\text\{_\}/g, "\\text{\\_}");
  // 3) `left(` / `right)` tanpa backslash → `\left(` / `\right)`.
  //    Hanya bila berdiri sebagai kata (didahului spasi/{/=/angka, diikuti kurung).
  s = s.replace(/(?<=[\s{=+*/^_(\d])left(?=\s*\()/g, "\\left");
  s = s.replace(/(?<=[\s{=+*/^_(\d])right(?=\s*[).\]])/g, "\\right");

  // ⚠️ Delimiter CAMPUR `\[ … \)` / `\( … \]` — cacat sumber.
  // ⚠️ Versi NAIF (`/\[\s\S]*?\)/`) menelan LINTAS-BATAS rumus → error 1→43.
  // Versi ini memakai lookahead: body DILARANG memuat `\]`/`\(`/`\)` (hanya
  // boleh delimiter penutup yang dicari). Diuji atas korpus 5.862 item:
  // error 384→300, MERUSAK 0. Aman.
  s = s.replace(/\\\[((?:(?!\\\]|\\\(|\\\)).)*?)\\\)/g, "\\[$1\\]");
  s = s.replace(/\\\(((?:(?!\\\]|\\\(|\\\)).)*?)\\\]/g, "\\($1\\)");

  // ⚠️ `\[`/`\]` BERSARANG: `\[ \[ … \] \]` (display di dalam display) — cacat
  // sumber yang muncul saat `$…\begin{align}…$` memuat `\[\begin{pmatrix}…\]`.
  // ⚠️ Versi lama memakai `((?:.*))\\\]\\\]` yang GREEDY → menelan seluruh teks
  // dan menghasilkan `\\\]` dobel. Versi ini menyasar `\]` yang LANGSUNG
  // berdampingan (`\]\]` atau `\] \]`) saja, tanpa `.*`.
  s = s.replace(/\\\](\s*)\\\]/g, "\\]$1");
  s = s.replace(/\\\[(\s*)\\\[/g, "\\[$1");

  // ⚠️ PERBAIKAN SPESIFIK: `\[`/`\]` BERSARANG DI DALAM `\begin{align}…\end{align}`.
  // Sumber defantri (artikel matriks) menulis:
  //   $\begin{align} \[\begin{pmatrix}…\] \cdot \[\begin{pmatrix}…\] &= …\end{align}$
  // Setelah konversi jadi `\[\begin{align} … \[\begin{pmatrix}…\] … \end{align}\]`.
  // Di dalam `align` yang sudah display, `\[`/`\]` adalah SAMPAH → KaTeX error.
  //
  // ⚠️ HANYA dijalankan bila `\begin{align}` benar-benar memuat `\[` — pola
  // spesifik, dipicu per-kasus. Percobaan GLOBAL (semua `\[…\]`) MERUSAK 2 kasus
  // (presisi <100%), karena itu dibatasi ke dalam `align` saja.
  s = s.replace(
    /\\begin\{(align|align\*|aligned|split|gather|gather\*)\}([\s\S]*?)\\end\{\1\}(?!\s*\{)/g,
    (m, env: string, body: string) => {
      if (!/\\\[|\\\]/.test(body)) return m; // tak ada sampah → biarkan apa adanya
      return `\\begin{${env}}${body.replace(/\\\[/g, "").replace(/\\\]/g, "")}\\end{${env}}`;
    },
  );

  // Perbaikan LaTeX ringan yang muncul di korpus.
  s = s.replace(/\\cancelto\{([^}]+)\}\{([^}]+)\}/g, "\\overset{$1}{\\cancel{$2}}");
  s = s.replace(/\\\\+\[\d+pt\]/g, "\\\\");

  return { text: s, imbalanced };
}

/**
 * Apakah ada `$` yatim? Pindai berurutan: `$$` pasangan (blok) → lompati;
 * `$…$` pasangan → lompati; `$` tanpa pasangan berikutnya → yatim.
 */
function hasOrphanDollar(s: string): boolean {
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === "\\") {
      i += 2; // lewati escape LaTeX (mis. \$)
      continue;
    }
    if (ch !== "$") {
      i++;
      continue;
    }
    if (s[i + 1] === "$") {
      // blok display: cari '$$' penutup
      const close = s.indexOf("$$", i + 2);
      if (close === -1) return true;
      i = close + 2;
      continue;
    }
    // inline: cari '$' penutup sebelum newline
    const nl = s.indexOf("\n", i + 1);
    const close = s.indexOf("$", i + 1);
    if (close === -1 || (nl !== -1 && nl < close)) return true;
    i = close + 1;
  }
  return false;
}

export interface CleanResult {
  /** Teks bersih (markdown ringan + math ternormalisasi). */
  text: string;
  /** URL gambar yang ditemukan (untuk `mediaManifest`). */
  media: string[];
  /** Catatan mutu (mis. delimiter rumus tak seimbang). */
  warnings: string[];
}

/**
 * Aturan general cleaning — pipa lengkap (fungsi murni).
 *
 * Urutan: blok → struktur→markdown → gambar → tag → **entitas** → spasi →
 * shortcode → math. (Entitas sebelum math: lihat catatan berkas.)
 */
export function cleanHtml(rawHtml: string): CleanResult {
  const warnings: string[] = [];
  if (!rawHtml || rawHtml.trim().length === 0) {
    return { text: "", media: [], warnings: ["HTML kosong"] };
  }

  // (0-2) buang blok kotor + iklan + boilerplate
  let s = stripNoiseBlocks(rawHtml);

  // (3) gambar → markdown (+ kumpulkan media)
  const img = extractImages(s);
  s = img.text;

  // (4) struktur → markdown (table dipertahankan)
  s = structureToMarkdown(s);

  // (5) entitas → karakter (SEBELUM stripTags! agar &amp; di LaTeX \begin{align} p &amp; = q menjadi &)
  s = decodeEntities(s);

  // (6) buang sisa tag
  s = stripTags(s);

  // (7) rapikan spasi
  s = normalizeWhitespace(s);

  // (8) shortcode daftar-hitam
  s = stripShortcodes(s);

  // (9) normalisasi math
  const math = normalizeMath(s);
  s = math.text;
  if (math.imbalanced) {
    warnings.push("Delimiter rumus ($) tak seimbang — perlu ditinjau");
  }

  // (9b) PERBAIKAN ADAPTIF: dipicu HANYA bila KaTeX masih mengeluh. Menjalankan
  // daftar perbaikan spesifik dan mempertahankan yang MENURUNKAN galat KaTeX
  // (diverifikasi ulang, bukan tebak-menebak). Teks yang sudah bersih tak
  // tersentuh. Lihat `katex-repair.ts` + tesnya.
  const repaired = repairAdaptive(s);
  if (repaired.after < repaired.before) {
    s = repaired.text;
    warnings.push(`KaTeX diperbaiki otomatis: ${repaired.applied.join(", ")} (${repaired.before}→${repaired.after})`);
  }

  // ⚠️ ATURAN PEMILIK (selalu, BUKAN lewat `repairAdaptive`): environment `align`
  // → `align*` (juga gather/equation). WAJIB di sini karena `align` biasa TIDAK
  // menghasilkan galat KaTeX, sehingga `repairAdaptive` (yang hanya memakai
  // perbaikan bila MENURUNKAN galat) akan MENOLAKnya. Tanpa langkah ini,
  // pembahasan/stem tetap `align` biasa walau `align*` yang diinginkan.
  s = s
    .replace(/\\begin\{align\}/g, "\\begin{align*}")
    .replace(/\\end\{align\}/g, "\\end{align*}")
    .replace(/\\begin\{gather\}/g, "\\begin{gather*}")
    .replace(/\\end\{gather\}/g, "\\end{gather*}")
    .replace(/\\begin\{equation\}/g, "\\begin{equation*}")
    .replace(/\\end\{equation\}/g, "\\end{equation*}");

  s = normalizeWhitespace(s);

  return { text: s, media: img.media, warnings };
}
