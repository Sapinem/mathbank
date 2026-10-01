"use client";

import katex from "katex";

/**
 * Renderer matematika + markdown ringan (L3/L6).
 *
 * Catatan CONSTRAINTS: `useMemo` dilarang (React Compiler). Karena itu kita
 * TIDAK memakai useMemo — komputasi token dilakukan langsung saat render.
 * (Daftar token dihitung murni dari `content` yang stabil.)
 */

/** Pisahkan teks menjadi potongan teks & rumus. */
type Token =
  | { kind: "text"; value: string }
  | { kind: "math"; value: string; display: boolean };

export function tokenizeMath(input: string): Token[] {
  const tokens: Token[] = [];
  // Mendukung DUA gaya (CONSTRAINTS #25: konten baru pakai \( \) ; data lama $ ):
  //   display: \[ ... \]  atau  $$ ... $$
  //   inline : \( ... \)   atau  $ ... $
  const re = /\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) {
      tokens.push({ kind: "text", value: input.slice(last, m.index) });
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
    tokens.push({ kind: "text", value: input.slice(last) });
  }
  return tokens;
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

/** Render satu potongan rumus ke HTML KaTeX. */
export function renderMath(value: string, display: boolean): string {
  try {
    return katex.renderToString(value, {
      displayMode: display,
      throwOnError: false,
      strict: false,
      output: "html",
    });
  } catch {
    // KaTeX gagal (langka karena `throwOnError:false`, tapi mungkin pada galat
    // internal) — JANGAN suntikkan `value` mentah ke dangerouslySetInnerHTML
    // (celah XSS). Escape dulu (audit MathBankAuditor / defense-in-depth).
    return `<span class="text-error">${escapeHtml(value)}</span>`;
  }
}

/**
 * Komponen render konten soal.
 *
 * Pembungkus punya `overflow-x-auto` (CONSTRAINTS #12) supaya rumus lebar
 * dapat digeser, bukan memecah layout halaman di layar sempit.
 */
export function MathContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const tokens = tokenizeMath(content);
  return (
    <span className={className ? `block overflow-x-auto ${className}` : "block overflow-x-auto"}>
      {tokens.map((t, i) =>
        t.kind === "text" ? (
          <span key={i} dangerouslySetInnerHTML={{ __html: renderText(t.value) }} />
        ) : (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: renderMath(t.value, t.display) }}
          />
        ),
      )}
    </span>
  );
}
