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

/** Pisahkan teks menjadi potongan teks, rumus, & gambar. */
type Token =
  | { kind: "text"; value: string }
  | { kind: "math"; value: string; display: boolean }
  | { kind: "img"; shortId: string };

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

export function tokenizeMath(input: string): Token[] {
  const tokens: Token[] = [];
  // Mendukung DUA gaya (CONSTRAINTS #25: konten baru pakai \\( \\) ; data lama $ ):
  //   display: \\[ ... \\]  atau  $$ ... $$
  //   inline : \\( ... \\)   atau  $ ... $
  const re = /\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;
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
      tokens.push({ kind: "math", value: m[3], display: false });
    } else {
      tokens.push({ kind: "math", value: m[4], display: false });
    }
    last = re.lastIndex;
  }
  if (last < input.length) {
    pushTextWithImages(tokens, input.slice(last));
  }
  return tokens;
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
    .replace(/`([^`]+)`/g, "<code>$1</code>")
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
 * Secara default pembungkus memiliki `overflow-x-auto` (CONSTRAINTS #12).
 * Jika `noScroll={true}` atau `className` mendefinisikan `overflow-hidden` / `truncate`,
 * scroll horizontal ditiadakan dan teks/rumus dipotong sesuai batas kontainer.
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
        "block",
        noScroll ? "overflow-hidden" : "overflow-x-auto",
        className,
      )}
    >
      {tokens.map((t, i) => {
        if (t.kind === "img") {
          return <MediaImage key={i} shortId={t.shortId} />;
        }
        return t.kind === "text" ? (
          <span key={i} dangerouslySetInnerHTML={{ __html: renderText(t.value) }} />
        ) : (
          <span
            key={i}
            // Skill §4: isolasi rumus inline dengan `.katex-inline` agar
            // ekspresi panjang menggulir di dalam kontainernya (bukan memaksa
            // viewport 360px menggulir horizontal). Utilitas Tailwind dipakai
            // langsung agar kontrak terjamin tanpa bergantung file CSS global.
            className={
              t.display
                ? undefined
                : "katex-inline inline-block max-w-full overflow-x-auto align-middle [scrollbar-width:thin]"
            }
            dangerouslySetInnerHTML={{ __html: renderMath(t.value, t.display) }}
          />
        );
      })}
    </span>
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
