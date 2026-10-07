"use client";

import katex from "katex";
import { cn } from "@/lib/utils";

/**
 * Renderer matematika + markdown ringan (L3/L6).
 *
 * Catatan CONSTRAINTS: `useMemo` dilarang (React Compiler). Karena itu kita
 * TIDAK memakai useMemo — komputasi token dilakukan langsung saat render.
 * (Daftar token dihitung murni dari `content` yang stabil.)
 *
 * PERF-02 — In-memory cache (LRU) untuk hasil kompilasi KaTeX:
 * `katex.renderToString` sinkron memblokir main thread. Saat guru menggeser
 * seleksi antar-kartu soal, rumus yang sama dikompilasi ulang berulang kali.
 * Cache modul-level ini mengembalikan HTML yang sudah jadi sehingga pergantian
 * kartu instan tanpa jank. Cache bertahan lintas render & komponen (bukan
 * state React) dan dibatasi kapasitas agar tak bocor memori pada sesi panjang.
 */

/** Pisahkan teks menjadi potongan teks, rumus, gambar, & tabel. */
type Token =
  | { kind: "text"; value: string }
  | { kind: "math"; value: string; display: boolean }
  | { kind: "img"; shortId: string }
  | {
      kind: "table";
      /** Sel header (teks/sub-markdown mentah — boleh mengandung rumus). */
      header: string[];
      /** Baris sel data. */
      rows: string[][];
      /** Penjajaran per kolom dari baris pemisah GFM (`:--`, `:-:`, `--:`). */
      align: Array<"left" | "center" | "right" | null>;
    };

/** Shortcode media `{{img:<shortId>}}` — sinkron dengan src/lib/media/shortcode.ts. */
const IMG_SHORTCODE = /\{\{\s*img\s*:\s*([0-9A-Za-z]{8})\s*\}\}/g;

/** Kapasitas maksimum entri cache KaTeX (LRU). */
const MATH_CACHE_MAX = 2000;

/**
 * LRU in-memory cache untuk HTML hasil KaTeX.
 *
 * `Map` mempertahankan urutan penyisipan; `get` memindahkan entri ke paling
 * akhir (baru dipakai). Saat kapasitas lewat batas, entri paling awal (paling
 * lama tak dipakai) dibuang — O(1) amortized. Aman karena hasil `renderToString`
 * murni (deterministik dari `value` + `display`).
 */
const mathHtmlCache = new Map<string, string>();

function cacheKey(value: string, display: boolean): string {
  return (display ? "d\u0000" : "i\u0000") + value;
}

/** Jumlah entri cache saat ini (dipakai tes & diagnosa). */
export function mathCacheSize(): number {
  return mathHtmlCache.size;
}

/** Kosongkan cache KaTeX (dipakai tes / invalidasi eksplisit). */
export function clearMathCache(): void {
  mathHtmlCache.clear();
}

/**
 * Deteksi blok tabel markdown GFM (pipe table) pada teks MENTAH (sebelum
 * tokenisasi rumus), lalu pecah input menjadi segmen tabel & non-tabel.
 *
 * Dilakukan SEBELUM pemisahan rumus karena sel tabel boleh memuat rumus
 * (`$...$`) — kalau tabel dideteksi setelah math dipisah, sel akan terpotong.
 * Tiap sel nanti ditokenisasi ulang, jadi rumus/gambar di dalam sel tetap
 * ter-render.
 *
 * Bentuk yang dikenali (baris pemisah wajib, minimal 1 baris data):
 *   | A | B |        A | B
 *   |---|---|   atau  --- | ---
 *   | 1 | 2 |        1 | 2
 */
type Segment = { kind: "table"; token: Extract<Token, { kind: "table" }> } | { kind: "text"; value: string };

/** Buang sel kosong di ujung (dari pipe pembuka/penutup `| a | b |`). */
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

/** Apakah baris ini baris pemisah GFM (`---`, `:--:`, dst.) untuk N kolom? */
function isSeparatorRow(line: string, cols: number): boolean {
  const cells = splitRow(line);
  if (cells.length !== cols) return false;
  return cells.every((c) => /^:?-{1,}:?$/.test(c.replace(/\s+/g, "")));
}

/** Penjajaran kolom dari baris pemisah. */
function parseAlign(line: string): Array<"left" | "center" | "right" | null> {
  return splitRow(line).map((c) => {
    const s = c.replace(/\s+/g, "");
    const left = s.startsWith(":");
    const right = s.endsWith(":");
    if (left && right) return "center" as const;
    if (left) return "left" as const;
    if (right) return "right" as const;
    return null;
  });
}

/** Apakah baris ini mengandung pipe (kandidat baris tabel). */
function looksLikeTableRow(line: string): boolean {
  return line.includes("|");
}

export function splitTableBlocks(input: string): Segment[] {
  const lines = input.split("\n");
  const segments: Segment[] = [];
  let buffer: string[] = [];

  const flushText = () => {
    if (buffer.length) {
      segments.push({ kind: "text", value: buffer.join("\n") });
      buffer = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const header = lines[i]!;
    const sep = lines[i + 1];
    if (
      looksLikeTableRow(header) &&
      sep !== undefined &&
      looksLikeTableRow(sep) &&
      isSeparatorRow(sep, splitRow(header).length)
    ) {
      // Konsumsi baris data berikutnya selama masih baris tabel.
      const cols = splitRow(header).length;
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && looksLikeTableRow(lines[j]!) && lines[j]!.trim() !== "") {
        const cells = splitRow(lines[j]!);
        // Normalisasi jumlah kolom agar tabel tetap rapi.
        while (cells.length < cols) cells.push("");
        rows.push(cells.slice(0, cols));
        j++;
      }
      flushText();
      segments.push({
        kind: "table",
        token: {
          kind: "table",
          header: splitRow(header),
          rows,
          align: parseAlign(sep!),
        },
      });
      i = j;
      continue;
    }
    buffer.push(header);
    i++;
  }
  flushText();
  return segments;
}

export function tokenizeMath(input: string): Token[] {
  const tokens: Token[] = [];
  // Blok tabel dipisah lebih dulu (sel boleh memuat rumus) — lihat splitTableBlocks.
  for (const seg of splitTableBlocks(input)) {
    if (seg.kind === "table") {
      tokens.push(seg.token);
    } else {
      tokenizeMathText(seg.value, tokens);
    }
  }
  return tokens;
}

/** Tokenisasi bagian teks (rumus + gambar + teks biasa) — tanpa tabel. */
function tokenizeMathText(input: string, tokens: Token[]): void {
  // Mendukung SEMUA gaya (CONSTRAINTS #25):
  //   display: \[ ... \]  /  \\\[ ... \\\]  /  $$ ... $$  /  $...multiline...$ (bila mengandung \begin)
  //   inline : \( ... \)  /  \\( ... \\)  /  $ ... $
  const re =
    /(?:\\\[|\\\\\[)([\s\S]+?)(?:\\\]|\\\\\])|\$\$([\s\S]+?)\$\$|(?<!\$)\$([\s\S]+?\\(?:begin|end)\{[\s\S]+?)\$|(?<!\$)\$([^$\n]+?)\$(?!\$)|(?:\\\((?:\\\\\(|\\\()??)([\s\S]+?)(?:\\\)|\\\\\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) {
      pushTextWithImages(tokens, input.slice(last, m.index));
    }
    if (m[1] !== undefined) {
      tokens.push({ kind: "math", value: m[1], display: true });
    } else if (m[2] !== undefined) {
      tokens.push({ kind: "math", value: m[2], display: true });
    } else if (m[3] !== undefined) {
      tokens.push({ kind: "math", value: m[3], display: true });
    } else if (m[4] !== undefined) {
      tokens.push({ kind: "math", value: m[4], display: false });
    } else if (m[5] !== undefined) {
      tokens.push({ kind: "math", value: m[5], display: false });
    }
    last = re.lastIndex;
  }
  if (last < input.length) {
    pushTextWithImages(tokens, input.slice(last));
  }
}

/**
 * Pecah teks biasa menjadi token teks & gambar.
 *
 * Gambar dipisah di sini (bukan di regex rumus) supaya shortcode `{{img:…}}`
 * TIDAK pernah tertelan sebagai rumus, dan sebaliknya.
 */
function pushTextWithImages(tokens: Token[], text: string): void {
  if (!text) return;
  let last = 0;
  IMG_SHORTCODE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMG_SHORTCODE.exec(text)) !== null) {
    if (m.index > last) tokens.push({ kind: "text", value: text.slice(last, m.index) });
    tokens.push({ kind: "img", shortId: m[1]! });
    last = IMG_SHORTCODE.lastIndex;
  }
  if (last < text.length) tokens.push({ kind: "text", value: text.slice(last) });
}

/** Escape entitas HTML dasar (anti-XSS). */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Inline markdown ringan: **tebal**, *miring*, `kode`, dan baris baru. */
function renderText(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="font-mono text-xs bg-transparent px-1 py-0.5 rounded">$1</code>')
    .replace(/\n/g, "<br/>");
}

/** Render satu potongan rumus ke HTML KaTeX (dengan cache LRU in-memory). */
export function renderMath(value: string, display: boolean): string {
  const key = cacheKey(value, display);
  const cached = mathHtmlCache.get(key);
  if (cached !== undefined) {
    // LRU: tandai baru dipakai dengan memindahkan ke ujung urutan.
    mathHtmlCache.delete(key);
    mathHtmlCache.set(key, cached);
    return cached;
  }

  let html: string;
  try {
    html = katex.renderToString(value, {
      displayMode: display,
      throwOnError: false,
      strict: false,
      output: "html",
    });
  } catch {
    // KaTeX gagal (langka karena `throwOnError:false`, tapi mungkin pada galat
    // internal) — JANGAN suntikkan `value` mentah ke dangerouslySetInnerHTML
    // (celah XSS). Escape dulu (audit MathBankAuditor / defense-in-depth).
    html = `<span class="text-error">${escapeHtml(value)}</span>`;
  }

  // Simpan hasil (sukses maupun fallback ter-escape) lalu terapkan batas LRU.
  mathHtmlCache.set(key, html);
  if (mathHtmlCache.size > MATH_CACHE_MAX) {
    const oldest = mathHtmlCache.keys().next().value;
    if (oldest !== undefined) mathHtmlCache.delete(oldest);
  }
  return html;
}

/**
 * Komponen render konten soal.
 *
 * Kontrak layout (CONSTRAINTS #12): rumus lebar TIDAK boleh memecah layout,
 * tetapi konten juga TIDAK boleh menjadi blok yang bisa digeser kanan-kiri.
 *
 * ATURAN:
 *  1. PEMBUNGKUS konten TIDAK pernah menjadi kontainer gulir. Default hanya
 *     `inline-block max-w-full` (teks & rumus inline mengalir/membungkus).
 *     `noScroll` hanya MENAMBAH `overflow-hidden` untuk memotong (mis. excerpt
 *     kartu daftar) — bukan untuk menggulir.
 *  2. RUmus INLINE mengalir sebagai elemen inline biasa + `max-w-full`.
 *  3. RUmus DISPLAY (blok) adalah SATU-SATUNYA yang menggulir sendiri, via
 *     `.katex-display` (globals.css) — itulah tempat rumus panjang (mis.
 *     `\begin{align}`) ditangani.
 *
 * CATATAN REGRESI:
 *  - MAT-47: tiap rumus inline pernah dibungkus `overflow-x-auto` → tiap rumus
 *    jadi kotak gulir sendiri.
 *  - Pembungkus pernah `overflow-x-auto` → blok seperti pembahasan & blok
 *    `sr-only` jadi area gulir (termasuk yang tak terlihat), menimbulkan scroll
 *    kanan-kiri yang membingungkan. Sekarang pembungkus tidak menggulir.
 */
export function MathContent({
  content,
  className,
  noScroll = false,
}: {
  content: string;
  className?: string;
  noScroll?: boolean;
}) {
  const tokens = tokenizeMath(content);
  return (
    <span
      className={cn(
        // Pembungkus TIDAK menggulir. Mengalir/membungkus secara alami.
        "inline-block max-w-full align-middle",
        // `noScroll` = potong (bukan gulir) bagi blok ringkas/tersembunyi.
        noScroll && "overflow-hidden",
        className,
      )}
    >
      {tokens.map((t, i) => (
        <TokenView key={i} token={t} />
      ))}
    </span>
  );
}

/** Render satu token (teks / rumus / gambar / tabel). Dipakai juga oleh sel tabel. */
function TokenView({ token }: { token: Token }) {
  if (token.kind === "img") {
    return <MediaImage shortId={token.shortId} />;
  }
  if (token.kind === "table") {
    return <MarkdownTable token={token} />;
  }
  if (token.kind === "text") {
    return <span dangerouslySetInnerHTML={{ __html: renderText(token.value) }} />;
  }
  return (
    <span
      // Rumus inline dibiarkan mengalir sebagai elemen inline biasa.
      // `.katex-inline` tetap dipakai (kontrak print.css MAT-40) dan
      // `max-w-full` mencegahnya melebihi kontainer.
      className={token.display ? undefined : "katex-inline max-w-full align-middle"}
      dangerouslySetInnerHTML={{ __html: renderMath(token.value, token.display) }}
    />
  );
}

/**
 * Tabel markdown GFM (pipe table).
 *
 * Sel boleh memuat rumus (`$...$`) & gambar — tiap sel ditokenisasi ulang lewat
 * `tokenizeMath`, jadi isinya kaya seperti teks biasa.
 *
 * Tabel lebar dibungkus kontainer `overflow-x-auto` SENDIRI: tabel memang sering
 * lebih lebar dari layar, dan inilah satu-satunya tempat gulir horizontal yang
 * tepat — tanpa mengganggu tata letak teks di sekitarnya.
 */
function MarkdownTable({ token }: { token: Extract<Token, { kind: "table" }> }) {
  const alignClass = (a: "left" | "center" | "right" | null) =>
    a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";
  return (
    <span className="my-2 block max-w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {token.header.map((cell, ci) => (
              <th
                key={ci}
                className={cn(
                  "border border-border bg-muted/40 px-3 py-1.5 font-semibold",
                  alignClass(token.align[ci] ?? null),
                )}
              >
                <CellContent value={cell} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {token.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={cn(
                    "border border-border px-3 py-1.5 align-middle",
                    alignClass(token.align[ci] ?? null),
                  )}
                >
                  <CellContent value={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </span>
  );
}

/** Isi satu sel tabel — tokenisasi ulang agar rumus/gambar ikut ter-render. */
function CellContent({ value }: { value: string }) {
  const tokens = tokenizeMath(value);
  return (
    <>
      {tokens.map((t, i) => (
        <TokenView key={i} token={t} />
      ))}
    </>
  );
}

/**
 * Gambar dari shortcode `{{img:<shortId>}}`.
 *
 * Berkas disajikan lewat `/img/{shortId}` (route yang menerjemahkan short_id →
 * berkas). Bila gagal dimuat, teks pengganti ditampilkan agar soal tetap terbaca
 * dan guru tahu ada gambar yang bermasalah — bukan ruang kosong tanpa penjelasan.
 */
function MediaImage({ shortId }: { shortId: string }) {
  return (
    <span className="inline-block align-middle">
      {/* eslint-disable-next-line @next/next/no-img-element -- media dari storage lokal (bukan CDN); next/image butuh loader khusus. */}
      <img
        src={`/img/${shortId}`}
        alt={`Gambar ${shortId}`}
        loading="lazy"
        className="my-2 inline-block max-h-96 max-w-full rounded border border-border"
        onError={(e) => {
          const el = e.currentTarget;
          el.style.display = "none";
          const fallback = el.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = "inline";
        }}
      />
      <span className="hidden rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
        [gambar {shortId} tidak dapat dimuat]
      </span>
    </span>
  );
}
