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

  // <blockquote> → lepas tag, isi tetap (JANGAN beri ">" dan JANGAN buang).
  s = s.replace(/<\/?blockquote\b[^>]*>/gi, "\n");

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

/** Ubah <img> → markdown, kembalikan sekaligus daftar URL gambar. */
export function extractImages(html: string): { text: string; media: string[] } {
  const media: string[] = [];
  let text = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const m = tag.match(/src=["']([^"']+)["']/i);
    if (!m) return "";
    const src = m[1]!.trim();
    if (src && !media.includes(src)) media.push(src);
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
  // Sembunyikan blok math ($$…$$ dan \[…\]) lebih dulu, lalu inline ($…$ dan \(…\)).
  s = s.replace(/\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]/g, hide);
  s = s.replace(/\$[^$\n]+?\$|\\\([^)]+?\\\)/g, hide);

  // Kini aman: buang semua tag.
  s = s.replace(/<[^>]+>/g, " ");

  // Kembalikan isi math.
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => store[Number(i)]!);
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
  // Display dulu ($$…$$) agar tak tertukar dengan inline.
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, body) => `\\[${body}\\]`);
  // Inline ($…$, tanpa newline)
  s = s.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (_, body) => `\\(${body}\\)`);

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

  // (5) buang sisa tag
  s = stripTags(s);

  // (6) entitas → karakter (SEBELUM math! agar &amp; di LaTeX jadi &)
  s = decodeEntities(s);

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

  s = normalizeWhitespace(s);

  return { text: s, media: img.media, warnings };
}
