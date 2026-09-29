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
  const re = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) {
      tokens.push({ kind: "text", value: input.slice(last, m.index) });
    }
    if (m[1] !== undefined) {
      tokens.push({ kind: "math", value: m[1], display: true });
    } else {
      tokens.push({ kind: "math", value: m[2], display: false });
    }
    last = re.lastIndex;
  }
  if (last < input.length) {
    tokens.push({ kind: "text", value: input.slice(last) });
  }
  return tokens;
}

/** Inline markdown ringan: **tebal**, *miring*, `kode`, dan baris baru. */
function renderText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br/>");
}

/** Render satu potongan rumus ke HTML KaTeX. */
function renderMath(value: string, display: boolean): string {
  try {
    return katex.renderToString(value, {
      displayMode: display,
      throwOnError: false,
      strict: false,
      output: "html",
    });
  } catch {
    return `<span class="text-error">${value}</span>`;
  }
}

/**
 * Komponen render konten soal.
 * `as` = elemen pembungkus (default span, agar inline).
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
    <span className={className}>
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
