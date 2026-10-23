"use client";

import katex from "katex";
import { cn } from "@/lib/utils";
import { tokenizeMath, type Token } from "@/lib/math/tokenize";

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
 * berkas). Shortcode `{{img:…}}` TIDAK membawa dimensi, jadi jangan menebak
 * rasio (mis. 4:3): `aspect-ratio` memaksa kotak yang salah untuk gambar
 * non-4:3 dan `width` menarik gambar kecil ke atas (blur). Biarkan browser
 * memakai rasio asli berkas.
 * Bila gagal dimuat, teks pengganti ditampilkan agar soal tetap terbaca
 * dan guru tahu ada gambar yang bermasalah — bukan ruang kosong tanpa penjelasan.
 */
function MediaImage({ shortId, alt }: { shortId: string; alt?: string }) {
  return (
    <span className="inline-block align-middle">
      {/* eslint-disable-next-line @next/next/no-img-element -- media dari storage lokal (bukan CDN); next/image butuh loader khusus. */}
      <img
        src={`/img/${shortId}`}
        alt={alt || `Gambar ${shortId}`}
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
