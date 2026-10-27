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
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { cleanHtml } from "../clean";
import { finalizeItem } from "../items";
import type { ArticleAdapter, ParsedItem, SegmentResult } from "../types";

/**
 * Root folder gambar korpus TKA.
 * Dapat dikonfigurasi melalui environment variable `CORPORA_BASE` atau `CORPUS_IMAGE_BASE`.
 */
function getTkaImagesDir(): string {
  const base =
    process.env.CORPORA_BASE?.trim() ||
    process.env.CORPUS_IMAGE_BASE?.trim() ||
    "/home/hari/projects/qbank/data/corpora";
  return join(base, "pusmendik_tka", "images");
}

/**
 * Ganti URL gambar REMOTE/RELATIF → `corpus://` LOKAL.
 *
 * ⚠️ Berbeda dari dayaserap (nama berkas = `<KODE>-<namaAsli>`), korpus TKA
 * menamai berkas berdasarkan URUTAN: `<slug>-img-<N>.png`. Jadi pemetaannya
 * juga berbasis urutan kemunculan gambar di HTML.
 *
 * Diverifikasi empiris (SHA-256 sama): `sd-matematika-p1-img-1.png` == gambar
 * cbt_images PERTAMA di `sd-matematika-p1.json`, dst.
 *
 * @param html  HTML artikel
 * @param slug  Nama berkas tanpa `.json` (mis. `sd-matematika-p1`)
 */
function lokalkanGambarTka(html: string, slug: string, globalIndeks?: Map<string, number>): string {
  if (!slug) return html;
  let indeks = globalIndeks;
  if (!indeks) {
    // Urutan URL unik sesuai kemunculan.
    const urut: string[] = [];
    for (const m of html.matchAll(/cbt_images\/([A-Za-z0-9_.-]+?\.(?:png|jpg|jpeg))/gi)) {
      if (!urut.includes(m[1]!)) urut.push(m[1]!);
    }
    if (urut.length === 0) return html;
    indeks = new Map(urut.map((u, i) => [u, i + 1]));
  }
  return html.replace(
    /(?:https?:\/\/[^)"'\s]*)?\/tka\/cbt_images\/([A-Za-z0-9_.-]+?\.(?:png|jpg|jpeg))/gi,
    (_m, nama: string) => {
      const n = indeks!.get(nama);
      if (!n) return _m;
      // ⚠️ EKSTENSI HARUS DARI BERKAS NYATA, bukan dari URL.
      // Bukti: `sd-matematika-p2` — URL ke-1 berekstensi `.jpg` (`72392_….jpg`),
      // tetapi berkas lokal `sd-matematika-p2-img-1.jpg` (bukan `.png`).
      // Menebak ekstensi dari URL bisa salah bila crawler menormalkan format.
      const ext = ekstensiGambarLokal(slug, n);
      return `corpus://pusmendik_tka/${slug}-img-${n}${ext}`;
    },
  );
}

/** Cache daftar berkas `images/` per-slug (dibaca sekali per proses). */
const _cacheEkstensi = new Map<string, Map<number, string>>();

/** Ekstensi berkas `<slug>-img-<n>.*` yang BENAR-BENAR ada di folder images/. */
function ekstensiGambarLokal(slug: string, n: number): string {
  let peta = _cacheEkstensi.get(slug);
  if (!peta) {
    peta = new Map();
    try {
      // Baca folder gambar korpus TKA (sinkron, sekali per slug).
      for (const b of readdirSync(getTkaImagesDir())) {
        const m = new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-img-(\\d+)(\\.\\w+)$`).exec(b);
        if (m) peta.set(Number(m[1]), m[2]!.toLowerCase());
      }
    } catch {
      /* folder tak ada → pakai default */
    }
    _cacheEkstensi.set(slug, peta);
  }
  return peta.get(n) ?? ".png";
}

export const pusmendikTkaAdapter: ArticleAdapter = (rawHtml, meta): SegmentResult => {
  const items: ParsedItem[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  // Slug dari judul/url (mis. `sd-matematika-p1`) untuk nama berkas lokal.
  let slug = (meta?.title ?? "").trim().replace(/\.json$/i, "") || "";
  if (slug.toLowerCase() === "simulasi tka" && meta?.url) {
    const uSlug = meta.url.split("/").filter(Boolean).pop()?.replace(/\.json$/i, "");
    if (uSlug) slug = uSlug;
  }

  // Bangun indeks gambar global untuk seluruh file rawHtml (urutan kemunculan di file).
  const globalUrut: string[] = [];
  for (const m of rawHtml.matchAll(/cbt_images\/([A-Za-z0-9_.-]+?\.(?:png|jpg|jpeg))/gi)) {
    if (!globalUrut.includes(m[1]!)) globalUrut.push(m[1]!);
  }
  const globalIndeks = new Map(globalUrut.map((u, i) => [u, i + 1]));

  // Tiap soal dibungkus `div.soal-soal … id="soal-no-N"`.
  const blocks = rawHtml.split(/(?=<div class="soal-soal)/i).filter((b) => /soal-no-\d+/i.test(b));
  if (blocks.length === 0) {
    return { items: [], skipped: 0, warnings: ["Tak ada blok 'soal-soal' (bukan halaman TKA)"] };
  }

  let idx = 0;
  for (const block of blocks) {
    idx++;

    // ── FORMAT B: tabel "Pernyataan | Benar | Salah" → `matrix_grid`. ──
    //
    // ⚠️ Sebagian soal TKA TIDAK memakai `pil="a"`, melainkan tabel dengan
    // radio `id="pilihan_<soal>_<baris>_<kolom>"` (value 1=Benar, 2=Salah).
    // Tanpa cabang ini, 9 dari 30 soal (30%) HILANG — terbukti di
    // `sd-matematika-p1` (21 blok ber-`pil`, 9 tanpa).
    const gridRows = parseTabelBenarSalah(block, slug);
    if (gridRows.length > 0) {
      const stemSource = extractStemSource(block);
      const stem = cleanHtml(lokalkanGambarTka(stripUi(stemSource), slug, globalIndeks)).text.trim();
      if (!stem) {
        skipped++;
        continue;
      }
      items.push(
        finalizeItem(stem, [], [], undefined, { index: idx }, [
          "Sumber TKA tanpa kunci di HTML (kunci di server) — perlu telaah",
        ], {
          type: "matrix_grid",
          dataPayload: { labels: ["Benar", "Salah"], rows: gridRows },
        }),
      );
      continue;
    }

    // Nama grup opsi di blok ini (name="pilihanN").
    const nameMatch = block.match(/<input\b[^>]*\bname="(pilihan\d+)"/i);
    if (!nameMatch) {
      skipped++;
      continue;
    }
    const name = nameMatch[1]!;

    // STEM = isi `div.isi-soal` SEBELUM pilihan opsi (soal = <img> + data-latex).
    const stemSource = extractStemSource(block);
    const stem = cleanHtml(lokalkanGambarTka(stripUi(stemSource), slug, globalIndeks)).text.trim();
    if (!stem) {
      skipped++;
      continue;
    }

    // OPSI: tiap radio (pil="a") → isi `<td …>` berikutnya (atribut bisa sembarang urutan).
    const opts: { label?: string; text: string }[] = [];
    const optRe = new RegExp(
      `<input\\b(?=[^>]*\\bpil="([a-z])")(?=[^>]*\\bname="${escapeRe(name)}")[^>]*>([\\s\\S]*?)(?=<input\\b[^>]*\\bpil=|<\\/table>|$)`,
      "gi",
    );
    let lm: RegExpExecArray | null;
    while ((lm = optRe.exec(block)) !== null) {
      const label = lm[1]!.toUpperCase();
      const text = cleanHtml(lokalkanGambarTka(stripUi(lm[2]!), slug, globalIndeks)).text.trim();
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

/**
 * Urai tabel "Pernyataan | Benar | Salah" (FORMAT B) → baris matrix_grid.
 *
 * Struktur nyata:
 *   <table>
 *     <thead><tr>…<td>Pernyataan</td><td>Benar</td><td>Salah</td></tr></thead>
 *     <tr><td>A.</td><td>PERNYATAAN…</td>
 *       <td>…<input id="pilihan_3_1_1" … value="1"></td>   ← Benar
 *       <td>…<input id="pilihan_3_1_2" … value="2"></td>   ← Salah
 *     </tr>…
 *   </table>
 *
 * Laba-label kolom diambil dari `<thead>` (mis. "Benar"/"Salah"), bukan
 * di-hardcode — supaya tahan variasi ("Ya"/"Tidak", "Sesuai"/"Tidak Sesuai").
 * `answer` selalu null (kunci tak ada di HTML).
 */
function parseTabelBenarSalah(block: string, slug: string): { text: string; answer: null }[] {
  // Hanya proses blok yang memakai id radio format B.
  if (!/id="pilihan_\d+_1_1"/i.test(block)) return [];

  const tbl = /<table[^>]*>([\s\S]*?)<\/table>/i.exec(block);
  if (!tbl) return [];

  const rows: { text: string; answer: null }[] = [];
  // Baris data: `<tr>` yang memuat `id="pilihan_<soal>_<baris>_…"`.
  for (const tr of tbl[1]!.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const isi = tr[1]!;
    if (!/id="pilihan_\d+_\d+_\d+"/i.test(isi)) continue;

    // Kolom: ambil tiap <td>. Kolom pernyataan = td pertama yang bukan penanda
    // huruf ("A."/"B.") dan bukan kolom radio.
    const tds = [...isi.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]!);
    const kandidat = tds.filter((t) => !/<input\b[^>]*type="radio"/i.test(t));
    // Buang kolom penanda "#"/huruf ("A.", "B.", …) — kolom pernyataan = yang
    // teksnya paling panjang.
    let teks = "";
    for (const t of kandidat) {
      const bersih = cleanHtml(lokalkanGambarTka(stripUi(t), slug)).text.trim();
      if (bersih.length > teks.length) teks = bersih;
    }
    if (teks) rows.push({ text: teks, answer: null });
  }
  return rows;
}

/** Ambil bagian `div.isi-soal` sebelum pilihan opsi (radio/checkbox/tabel). */
function extractStemSource(block: string): string {
  // Potong sebelum komentar penanda opsi (radio atau checkbox)
  const pgIdx = block.search(/<!--\s*PG\b[^>]*-->/i);
  const head = pgIdx === -1 ? block : block.slice(0, pgIdx);

  // Jika tidak ada komentar PG tapi ada tabel pilihan:
  const tableIdx = head.search(/<table\b[^>]*class="[^"]*\btable\b[^"]*"/i);
  const beforeTable = tableIdx === -1 ? head : head.slice(0, tableIdx);

  // Mulai dari div.isi-soal bila ada (hindari kolom kosong cont-soal).
  const isi = beforeTable.search(/<div class="[^"]*\bisi-soal\b[^"]*"/i);
  const from = isi === -1 ? 0 : isi;
  return beforeTable.slice(from);
}

/** Buang elemen UI interaktif (radio, tombol, label kosong, komentar XML, modal/dialog CBT). */
function stripUi(s: string): string {
  return s
    .replace(/<div\b[^>]*\bmodal\b[\s\S]*$/gi, "")
    .replace(/Daftar Soal[\s\S]*$/gi, "")
    .replace(/Informasi Soal[\s\S]*$/gi, "")
    .replace(/PERHATIAN\s*!![\s\S]*$/gi, "")
    .replace(/<input\b[^>]*>/gi, "")
    .replace(/<label\b[^>]*>\s*<\/label>/gi, "")
    .replace(/<div class="radio[^"]*"[^>]*>/gi, "")
    .replace(/<div class="[^"]*\bisi-soal\b[^"]*"[^>]*>/gi, "")
    .replace(/<div class="[^"]*\bcont-soal\b[^"]*"[^>]*>/gi, "")
    .replace(/<\?xml[^>]*\?>/gi, "")
    .replace(/<!--\?xml[^>]*-->/gi, "")
    .replace(/<!--\s*PG\b[^>]*-->/gi, "");
}

/** Escape untuk RegExp. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
