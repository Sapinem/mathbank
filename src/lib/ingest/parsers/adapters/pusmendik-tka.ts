/**
 * Adapter pusmendik_tka — HTML halaman ujian TKA (M9-2c).
 *
 * Struktur NYATA (temuan langsung):
 *   <div class="soal-soal …" id="soal-no-1">
 *     <div class="col-lg-6 cont-soal">…</div>
 *     <div class="col-lg-6 isi-soal">
 *       <p><img src="/tka/cbt_images/…" data-latex="…"></p>   ← SOAL = gambar (+latex)
 *       <!-- PG -->
 *       <table><tr>
 *         <td><div class="radio…"><input pil="a" name="pilihan1" type="radio"></div></td>
 *         <td><p><img src="/tka/cbt_images/…"></p></td>        ← OPSI A = gambar
 *         … ulang untuk b,c,d …
 *       </table>
 *     </div>
 *   </div>
 *
 * ⚠️ **Kunci TIDAK ada di HTML** (disimpan di server). `jawaban_no[N]` hanya
 * nomor urut soal. Sesuai aturan: kosong + catatan.
 *
 * Catatan: `src` gambar **relatif** (`/tka/cbt_images/…`) → absolutkan
 * terhadap `meta.url` bila ada (dilakukan lapisan media).
 */
import { cleanHtml } from "../clean";
import { finalizeItem } from "../items";
import type { ArticleAdapter, ParsedItem, SegmentResult } from "../types";

export const pusmendikTkaAdapter: ArticleAdapter = (rawHtml): SegmentResult => {
  const items: ParsedItem[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  // Tiap soal dibungkus `div.soal-soal … id="soal-no-N"`.
  const blocks = rawHtml.split(/(?=<div class="soal-soal)/i).filter((b) => /soal-no-\d+/i.test(b));
  if (blocks.length === 0) {
    return { items: [], skipped: 0, warnings: ["Tak ada blok 'soal-soal' (bukan halaman TKA)"] };
  }

  let idx = 0;
  for (const block of blocks) {
    idx++;

    // Nama grup opsi di blok ini (name="pilihanN").
    const nameMatch = block.match(/<input\b[^>]*\bname="(pilihan\d+)"/i);
    if (!nameMatch) {
      skipped++;
      continue;
    }
    const name = nameMatch[1]!;

    // STEM = isi `div.isi-soal` SEBELUM `<!-- PG -->` (soal = <img> + data-latex).
    const stemSource = extractStemSource(block);
    const stem = cleanHtml(stripUi(stemSource)).text.trim();
    if (!stem) {
      skipped++;
      continue;
    }

    // OPSI: tiap radio (pil="a") → isi `<td …>` berikutnya.
    const opts: { label?: string; text: string }[] = [];
    const optRe = new RegExp(
      `<input\\b[^>]*\\bpil="([a-z])"[^>]*\\bname="${escapeRe(name)}"[^>]*>([\\s\\S]*?)(?=<input\\b[^>]*\\bpil=|<\\/table>|$)`,
      "gi",
    );
    let lm: RegExpExecArray | null;
    while ((lm = optRe.exec(block)) !== null) {
      const label = lm[1]!.toUpperCase();
      const text = cleanHtml(stripUi(lm[2]!)).text.trim();
      if (text) opts.push({ label, text });
    }

    items.push(
      finalizeItem(stem, opts, [], undefined, { index: idx }, [
        "Sumber TKA tanpa kunci di HTML (kunci di server) — perlu telaah",
      ]),
    );
  }

  return { items, skipped, warnings };
};

/** Ambil bagian `div.isi-soal` sebelum `<!-- PG -->` (soal inti). */
function extractStemSource(block: string): string {
  const pgIdx = block.search(/<!--\s*PG\s*-->/i);
  const head = pgIdx === -1 ? block : block.slice(0, pgIdx);

  // Mulai dari div.isi-soal bila ada (hindari kolom kosong cont-soal).
  const isi = head.search(/<div class="[^"]*\bisi-soal\b[^"]*"/i);
  const from = isi === -1 ? 0 : isi;
  return head.slice(from);
}

/** Buang elemen UI interaktif (radio, tombol, label kosong, komentar XML). */
function stripUi(s: string): string {
  return s
    .replace(/<input\b[^>]*>/gi, "")
    .replace(/<label\b[^>]*>\s*<\/label>/gi, "")
    .replace(/<div class="radio[^"]*"[^>]*>/gi, "")
    .replace(/<div class="[^"]*\bisi-soal\b[^"]*"[^>]*>/gi, "")
    .replace(/<div class="[^"]*\bcont-soal\b[^"]*"[^>]*>/gi, "")
    .replace(/<\?xml[^>]*\?>/gi, "")
    .replace(/<!--\?xml[^>]*-->/gi, "")
    .replace(/<!--\s*PG\s*-->/gi, "");
}

/** Escape untuk RegExp. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
