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
 * Keputusan user (2026-09-30):
 *   - Shortcode = **daftar-hitam** ([collapse],[spoiler]) — BUKAN buang-semua `[a-z]`
 *     (mis. `[n]`,`[m]` adalah LaTeX — buang-semua akan MERUSAK matematika).
 *   - `<table>` **dipertahankan** HTML; `<ul>/<ol>/<li>`, `<blockquote>`, `<hr>`,
 *     `<code>` dikonversi ke markdown.
 */

/** Nama shortcode yang dibuang (daftar-hitam). Lihat EVALUASI-KORPUS-KOMPREHENSIF. */
const DROP_SHORTCODES = ["collapse", "spoiler"] as const;

/** Blok yang isinya dibuang total (beserta tag-nya). */
const DROP_BLOCKS =
  /<(script|style|noscript|iframe|svg|form|button|ins|nav|aside|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi;

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
  middot: "·",
  laquo: "«",
  raquo: "»",
  copy: "©",
  reg: "®",
  trade: "™",
  prime: "′",
  Prime: "″",
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
 * Buang blok yang tak berguna: script/style/noscript/iframe/svg/form/button/ins
 * (beserta isinya), komentar HTML, iklan AdSense, dan boilerplate situs.
 */
export function stripNoiseBlocks(html: string): string {
  let s = html;
  s = s.replace(HTML_COMMENT, "");
  s = s.replace(ADSENSE_DIV, "");
  s = s.replace(ADSENSE_LEFTOVER, "");
  s = s.replace(DROP_BLOCKS, "");
  s = s.replace(DROP_EMPTY_BLOCKS, "");
  return s;
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
 *   <br> → \n · <li> → "- " / "1. " · <blockquote> → ">" · <hr> → "---" · <code> → `` ` ``
 * `<table>` DIPERTAHANKAN (dibiarkan apa adanya).
 */
export function structureToMarkdown(html: string): string {
  let s = html;

  // <br> → newline
  s = s.replace(/<br\s*\/?>/gi, "\n");

  // <hr> → ---
  s = s.replace(/<hr\b[^>]*>/gi, "\n\n---\n\n");

  // <pre>/<code> → fenced inline code (kasar tapi aman)
  s = s.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, inner) => `\n\n\`\`\`\n${stripTags(inner).trim()}\n\`\`\`\n\n`);
  s = s.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, inner) => `\`${stripTags(inner).trim()}\``);

  // <blockquote> → "> "
  s = s.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
    const text = stripTags(inner).trim();
    return (
      "\n\n" +
      text
        .split(/\n+/)
        .map((l) => `> ${l.trim()}`)
        .join("\n") +
      "\n\n"
    );
  });

  // <ol> → "1. ", <ul> → "- "
  s = s.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => {
    let i = 0;
    return (
      "\n" +
      splitListItems(inner)
        .map((item) => `${++i}. ${item}`)
        .join("\n") +
      "\n"
    );
  });
  s = s.replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) =>
    "\n" + splitListItems(inner).map((item) => `- ${item}`).join("\n") + "\n",
  );

  return s;
}

/** Pisah isi <ol>/<ul> menjadi item teks (tanpa tag). */
function splitListItems(inner: string): string[] {
  return inner
    .split(/<\/li>/i)
    .map((chunk) => stripTags(chunk.replace(/<li\b[^>]*>/gi, "")).trim())
    .filter((t) => t.length > 0);
}

/** Ubah <img> → markdown, kembalikan sekaligus daftar URL gambar. */
export function extractImages(html: string): { text: string; media: string[] } {
  const media: string[] = [];
  const text = html.replace(/<img\b[^>]*>/gi, (tag) => {
    const m = tag.match(/src=["']([^"']+)["']/i);
    if (!m) return "";
    const src = m[1]!.trim();
    if (src && !media.includes(src)) media.push(src);
    const alt = tag.match(/alt=["']([^"']*)["']/i);
    return `\n\n![${alt ? alt[1] : "Gambar"}](${src})\n\n`;
  });
  return { text, media };
}

/** Buang SEMUA sisa tag HTML → spasi (kecuali yang sengaja dipertahankan). */
export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
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
