/**
 * Normalisasi separator LaTeX untuk Moodle (M12).
 *
 * MathBank menyimpan rumus dengan DUA gaya:
 *   inline : `$…$`   atau `\\( … \\)`
 *   display: `$$…$$` atau `\\[ … \\]`
 *
 * **Filter TeX Moodle** mengenali `\\( … \\)` (inline) & `\\[ … \\]` (display),
 * BUKAN `$…$`. Jadi saat ekspor kita **ubah semua `$…$` → `\\(…\\)` dan
 * `$$…$$` → `\\[…\\]`** (keputusan user 2026-09-30). Gaya `\\( \\)` yang sudah
 * ada dibiarkan.
 *
 * Fungsi ini **murni** (tanpa DB/DOM) → mudah diuji.
 */

/** Potongan teks hasil tokenisasi. */
type Token =
  | { kind: "text"; value: string }
  | { kind: "math"; value: string; display: boolean };

/**
 * Pisahkan teks menjadi teks & rumus (salinan logika `tokenizeMath` di
 * `MathContent`, dipisah agar sisi server tak mengimpor komponen klien).
 *
 * Urutan alternasi penting: `$$`/`\\[` (display) dicek sebelum `$`/`\\(`.
 */
export function tokenizeLatex(input: string): Token[] {
  const tokens: Token[] = [];
  const re =
    /\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m.index > last) tokens.push({ kind: "text", value: input.slice(last, m.index) });
    if (m[1] !== undefined) tokens.push({ kind: "math", value: m[1], display: true });
    else if (m[2] !== undefined) tokens.push({ kind: "math", value: m[2], display: true });
    else if (m[3] !== undefined) tokens.push({ kind: "math", value: m[3], display: false });
    else tokens.push({ kind: "math", value: m[4], display: false });
    last = re.lastIndex;
  }
  if (last < input.length) tokens.push({ kind: "text", value: input.slice(last) });
  return tokens;
}

/**
 * Ubah seluruh rumus ke separator Moodle (`\\( \\)` inline, `\\[ \\]` display),
 * mempertahankan teks di antaranya apa adanya.
 */
export function toMoodleLatex(input: string): string {
  if (!input) return "";
  return tokenizeLatex(input)
    .map((t) =>
      t.kind === "text"
        ? t.value
        : t.display
          ? `\\[${t.value}\\]`
          : `\\(${t.value}\\)`,
    )
    .join("");
}
