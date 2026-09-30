/**
 * Adapter defantri (M9).
 *
 * Struktur (temuan langsung):
 *   <h4>3. Soal OSN-K …</h4>                          ← judul/nomor (opsional)
 *   <blockquote>…stem…
 *     <div class="question">
 *       <label><div class="box white">
 *         <input type="radio" name="q40" value="correct">$(A)$ …opsi A…
 *       </div></label>
 *       <label><div class="box white">
 *         <input type="radio" name="q40" value="corect">$(B)$ …opsi B…   ← TYPO di sumber
 *       </div></label>
 *   </div></blockquote>
 *
 * **Pemisah soal yang andal = `name="qN"`** (bukan `<blockquote>`, yang bisa
 * menggabungkan beberapa soal jadi satu — menyebabkan banyak "kunci" palsu).
 * Tiap grup `qN` = satu soal.
 *
 * **Kunci**: `value="correct"` — dengan **toleransi typo** (`corect`, …).
 * Bila **semua** opsi `corect` (tanpa `correct`) → sumber memang tanpa kunci.
 *
 * Catatan: defantri sering **tanpa pembahasan**.
 */
import { cleanHtml } from "../clean";
import { finalizeItem } from "../items";
import type { ArticleAdapter, ParsedItem, SegmentResult } from "../types";

/**
 * Nilai radio yang menandakan **kunci**.
 *
 * ⚠️ PENTING (temuan korpus): `value="correct"` = KUNCI; `value="corect"` =
 * **PENGECOH** (sengaja, 32.752×). Jangan masukkan `corect` — itu akan menandai
 * SEMUA opsi sebagai benar!
 *
 * Toleransi ejaan HANYA untuk varian `correct` yang salah ketik di sumber
 * (`crorect`, `corrrect`, `crrect`).
 */
const CORRECT_VALUES = ["correct", "crorect", "corrrect", "crrect", "coorect"];

export const defantriAdapter: ArticleAdapter = (rawHtml): SegmentResult => {
  const items: ParsedItem[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  // Kumpulkan nama grup radio (name="qN") — tiap grup = satu soal.
  const names = new Set<string>();
  const nameRe = /<input\b[^>]*type="radio"[^>]*name="([^"]+)"/gi;
  let nm: RegExpExecArray | null;
  while ((nm = nameRe.exec(rawHtml)) !== null) names.add(nm[1]!);

  if (names.size === 0) {
    return { items: [], skipped: 0, warnings: ["Tak ada radio grup 'qN' (bukan artikel soal defantri)"] };
  }

  let idx = 0;
  for (const name of names) {
    idx++;
    const group = extractQuestionGroup(rawHtml, name);
    if (!group) {
      skipped++;
      continue;
    }

    // STEM = isi SEBELUM radio pertama. `<div class="question">` kadang
    // membungkus stem (bukan opsi saja) → buang TAG-nya, isi tetap.
    const firstRadio = group.search(/<input\b[^>]*type="radio"/i);
    const stemSource = firstRadio === -1 ? group : group.slice(0, firstRadio);
    const stem = cleanHtml(stemSource.replace(/<\/?div\b[^>]*>/gi, "\n")).text.trim();

    // OPSI (hanya radio yang name-nya cocok).
    const opts: { label?: string; text: string }[] = [];
    const correct: string[] = [];
    const optRe = new RegExp(
      `<input\\b[^>]*type="radio"[^>]*name="${escapeRe(name)}"[^>]*value="([^"]*)"[^>]*>([\\s\\S]*?)(?=<\\/label>|$)`,
      "gi",
    );
    let lm: RegExpExecArray | null;
    while ((lm = optRe.exec(group)) !== null) {
      const val = lm[1]!.trim().toLowerCase();
      let text = cleanHtml(lm[2]!).text;
      let label: string | undefined;
      // Label di depan: dari `$(A)$` → setelah cleaning jadi `\((A)` … `\)`.
      // Buang pembuka `\((A)` dan penutup `\)` yang menjadi sisa.
      text = text.replace(/^\s*(?:\\?\()+\s*([A-H])\s*(?:\\?\))*/i, (_mm, letter: string) => {
        label = letter.toUpperCase();
        return "";
      });
      // Sisa LaTeX pembuka/penutup `\(` `\)` di tepi (dari `$…$`).
      text = text.replace(/^\s*\\?\(\s*/, "").replace(/\s*\\?\)\s*$/, "").trim();
      if (text) {
        opts.push({ label, text });
        if (CORRECT_VALUES.includes(val) && label) correct.push(label);
      }
    }

    if (!stem) {
      skipped++;
      continue;
    }

    items.push(finalizeItem(stem, opts, correct, undefined, { index: idx, heading: undefined }, []));
  }

  return { items, skipped, warnings };
};

/**
 * Ambil potongan HTML milik grup radio `name`: dari radio pertama grup ini
 * s/d radio pertama grup **berikutnya** (nama berbeda); disertakan mundur ke
 * pembuka soal terdekat (`<h4>`/`<h3>`/`<blockquote>`/`<!--more-->`).
 */
function extractQuestionGroup(html: string, name: string): string | null {
  const first = html.search(new RegExp(`<input\\b[^>]*name="${escapeRe(name)}"`, "i"));
  if (first === -1) return null;

  const back = html.slice(0, first);
  const starts = [
    back.lastIndexOf("<h4"),
    back.lastIndexOf("<h3"),
    back.lastIndexOf("<h2"),
    back.lastIndexOf("<!--more-->"),
    back.lastIndexOf("<blockquote"),
  ].filter((i) => i !== -1);
  const start = starts.length ? Math.max(...starts) : Math.max(0, first - 2000);

  // Akhir: radio pertama dengan nama **berbeda** setelah ini.
  const rest = html.slice(first + 1);
  const re = /<input\b[^>]*type="radio"[^>]*name="([^"]+)"/gi;
  let end = html.length;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest)) !== null) {
    if (m[1] !== name) {
      end = first + 1 + m.index;
      break;
    }
  }

  return html.slice(start, end);
}

/** Escape untuk dipakai dalam RegExp. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
