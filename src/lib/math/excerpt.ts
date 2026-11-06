/**
 * Pemrosesan cuplikan (excerpt), strip gambar, dan perataan rumus matematika (L4 Engine).
 * Fungsi murni, bebas dependensi React/DOM.
 */

/**
 * Factory regex segmen matematika KaTeX dan LaTeX environments (L4).
 * Menghasilkan RegExp baru pada setiap pemanggilan untuk mencegah efek samping stateful lastIndex (/g).
 */
export function createMathSegmentRegex(): RegExp {
  return /(?:\\\[|\\\\\[)[\s\S]*?(?:\\\]|\\\\\])|\$\$[\s\S]*?\$\$|(?<!\$)\$[^$]*?\\(?:begin|end)\{[^$]*?\}\$(?!\$)|(?<!\$)\$[^$\n]+?\$(?!\$)|(?:\\\(|\\\\\()[\s\S]*?(?:\\\)|\\\\\))|\\begin\{(?:matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases|aligned|array|align\*?)\}[\s\S]*?\\end\{(?:matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases|aligned|array|align\*?)\}/g;
}

/** Bersihkan pemformatan markdown (#, *, `) HANYA pada teks biasa di luar rumus matematika. */
export function cleanMarkdownExcludingMath(md: string): string {
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = createMathSegmentRegex();

  while ((match = re.exec(md)) !== null) {
    const textBefore = md.slice(lastIndex, match.index);
    if (textBefore) {
      result += textBefore.replace(/[#*`]/g, "").replace(/\r?\n+/g, " ");
    }
    result += match[0].replace(/\r?\n+/g, " ");
    lastIndex = re.lastIndex;
  }

  const remaining = md.slice(lastIndex);
  if (remaining) {
    result += remaining.replace(/[#*`]/g, "").replace(/\r?\n+/g, " ");
  }

  return result.replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * Kutipan singkat konten yang aman terhadap rumus KaTeX/LaTeX.
 * Tidak akan pernah memotong di tengah delimiter \(...\), \[...\], $...$, atau $$...$$.
 */
export function excerpt(md: string, max = 140): string {
  const clean = cleanMarkdownExcludingMath(md);
  if (clean.length <= max) return clean;

  const mathRegex = createMathSegmentRegex();
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(clean)) !== null) {
    const textBefore = clean.slice(lastIndex, match.index);
    if (textBefore) {
      if (result.length + textBefore.length >= max) {
        const remaining = max - result.length;
        result += textBefore.slice(0, Math.max(0, remaining)).trimEnd() + "…";
        return result;
      }
      result += textBefore;
    }

    const mathToken = match[0];
    if (result.length + mathToken.length > max) {
      if (result.length > 0) {
        return result.trimEnd() + "…";
      }
      // Jika soal diawali rumus panjang, sertakan rumus pertama utuh lalu elipsis
      return mathToken + "…";
    }

    result += mathToken;
    lastIndex = mathRegex.lastIndex;
  }

  const remainingText = clean.slice(lastIndex);
  if (remainingText) {
    if (result.length + remainingText.length > max) {
      const remaining = max - result.length;
      result += remainingText.slice(0, Math.max(0, remaining)).trimEnd() + "…";
      return result;
    }
    result += remainingText;
  }

  return result.length > max ? result.slice(0, max) + "…" : result;
}

/**
 * Buang rujukan gambar shortcode `{{img:...}}` maupun sintaks markdown `![]()`
 * agar teks ringkasan (misal tampilan list) bersih dari elemen gambar.
 */
export function stripImages(text: string): string {
  return text
    .replace(/\{\{\s*img\s*:[^}]+\}\}/gi, "")
    .replace(/!\[[^\]]*\](?:\([^)]*\)|\[[^\]]*\])/g, "");
}

function flattenMathSegment(math: string): string {
  return math
    .replace(/\\begin\{(?:matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases|aligned|array|align\*?)\}/g, "")
    .replace(/\\end\{(?:matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases|aligned|array|align\*?)\}/g, "")
    .replace(/(?<!\\)&\s*=/g, "=")
    .replace(/(?<!\\)&/g, ",\\; ")
    .replace(/\\\\/g, ",\\; ");
}

/**
 * Ratakan lingkungan rumus multi-baris (matrix, cases, aligned, \\)
 * HANYA di dalam segmen matematika, dan bersihkan rujukan gambar agar menjadi datar/inline pada mode list.
 */
export function flattenMathForList(text: string): string {
  const stripped = stripImages(text);
  const re = createMathSegmentRegex();
  return stripped.replace(re, (segment) => flattenMathSegment(segment));
}
