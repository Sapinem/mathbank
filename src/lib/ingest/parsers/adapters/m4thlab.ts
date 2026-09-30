/**
 * Adapter m4thlab — sumber paling terstruktur (M9).
 *
 * Struktur (temuan langsung):
 *   <div class="contoh-soal">
 *     <div class="cs-header">Contoh Soal 1</div>
 *     <div class="cs-body">
 *       <div class="cs-teks">…stem…</div>
 *       <div class="cs-toggle-pem">Lihat Pembahasan ▼</div>   ← abaikan
 *       <div class="cs-pembahasan"><div class="cs-pem-body">…pembahasan…</div></div>
 *     </div>
 *   </div>
 * Varian dengan opsi:
 *   <div class="cs-opsi">
 *     <div class="cs-opt" onclick="pilihJawaban(this, true)">   ← true = KUNCI
 *       <span class="cs-marker">A</span><span class="cs-opt-text">…</span></div>
 *
 * **Kunci terbaca pasti** dari `pilihJawaban(this, true|false)`.
 */
import { cleanHtml } from "../clean";
import { finalizeItem } from "../items";
import type { ArticleAdapter, ParsedItem, SegmentResult } from "../types";

export const m4thlabAdapter: ArticleAdapter = (rawHtml): SegmentResult => {
  const warnings: string[] = [];
  const items: ParsedItem[] = [];
  let skipped = 0;

  // Pecah per pembungkus <div class="contoh-soal">.
  const blocks = rawHtml.split(/<div class="contoh-soal"/i).slice(1);
  if (blocks.length === 0) {
    return { items: [], skipped: 0, warnings: ["Tak ada blok contoh-soal (bukan artikel soal)"] };
  }

  blocks.forEach((block, idx) => {
    const header = block.match(/<div class="cs-header">([\s\S]*?)<\/div>/i);
    const heading = header ? stripInline(header[1]!) : undefined;

    // STEM dari cs-teks (atau cs-body bila tak ada cs-teks).
    const stemRaw =
      matchBlock(block, "cs-teks") ??
      (block.match(/<div class="cs-body">([\s\S]*?)<div class="cs-toggle-pem"/i)?.[1] ?? "");
    const stem = cleanHtml(stemRaw).text;
    if (!stem) {
      skipped++;
      return;
    }

    // OPSI (varian objektif) + KUNCI.
    const opts: { label?: string; text: string }[] = [];
    const correct: string[] = [];
    const optRe =
      /<div class="cs-opt"[^>]*onclick="pilihJawaban\(this,\s*(true|false)\)"[^>]*>([\s\S]*?)<\/div>/gi;
    let om: RegExpExecArray | null;
    while ((om = optRe.exec(block)) !== null) {
      const isTrue = om[1]!.toLowerCase() === "true";
      const label = om[2]!.match(/class="cs-marker">\s*([A-H])\s*</i)?.[1];
      const text = cleanHtml(om[2]!.replace(/<span class="cs-marker">[\s\S]*?<\/span>/i, "")).text;
      if (text) {
        opts.push({ label, text });
        if (isTrue) correct.push((label ?? "").toUpperCase());
      }
    }

    // PEMBAHASAN dari cs-pem-body.
    const pemRaw = matchBlock(block, "cs-pem-body");
    const explanation = pemRaw ? cleanHtml(pemRaw).text : undefined;

    items.push(
      finalizeItem(stem, opts, correct, explanation, { index: idx + 1, heading }, []),
    );
  });

  return { items, skipped, warnings };
};

/** Ambil isi <div class="X">…</div> (penutup div pertama). */
function matchBlock(html: string, cls: string): string | null {
  const re = new RegExp(`<div class="[^"]*\\b${cls}\\b[^"]*"[^>]*>`, "i");
  const m = re.exec(html);
  if (!m) return null;
  const after = html.slice(m.index + m[0].length);
  const close = after.indexOf("</div>");
  return close === -1 ? after : after.slice(0, close);
}

/** Bersihkan teks inline sederhana (tanpa proses penuh). */
function stripInline(html: string): string {
  return cleanHtml(html).text.replace(/\s+/g, " ").trim();
}
