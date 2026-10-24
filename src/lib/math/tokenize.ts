/**
 * Tokenizer matematika & markdown ringan (L4 — murni, tanpa React).
 *
 * DIPISAH dari `components/math/math-content.tsx` (modul `"use client"`)
 * karena parser ingest (L3) juga butuh `tokenizeMath` untuk menghitung galat
 * KaTeX. Bila tokenizer tinggal di modul UI, lapisan ingest ikut menarik React
 * dan komponen klien — pelanggaran batas lapisan (AGENTS §9.1).
 */

/** Pisahkan teks menjadi potongan teks, rumus, gambar, & tabel. */
export type Token =
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
export type Segment =
  | { kind: "table"; token: Extract<Token, { kind: "table" }> }
  | { kind: "text"; value: string };

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
    /(?:\\\[|\\\\\[)([\s\S]+?)(?:\\\]|\\\\\])|\$\$([\s\S]+?)\$\$|(?<!\$)\$([^$]*?\\(?:begin|end)\{[^$]*?)\$(?!\$)|(?<!\$)\$([^$\n]+?)\$(?!\$)|(?:\\\(|\\\\\()([\s\S]+?)(?:\\\)|\\\\\))/g;
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
