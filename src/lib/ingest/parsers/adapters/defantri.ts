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
import { repairAdaptive } from "../katex-repair";
import { finalizeItem } from "../items";
import type { ArticleAdapter, ParsedItem, SegmentResult } from "../types";
import {
  buildTrueFalseItem,
  collectTrueFalseQuestions,
  trueFalseGroupNames,
} from "./defantri-tf";
import { detectWacana, stripSubNumber } from "./defantri-wacana";

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

  // ── BENAR-SALAH (`matrix_grid`) ────────────────────────────────────────
  // Satu `<ul>` pernyataan = satu soal. Grup BS DIKELUARKAN dari jalur PG di
  // bawah agar tidak jadi soal pilihan ganda rusak. Lihat `defantri-tf.ts`.
  const tfQuestions = collectTrueFalseQuestions(rawHtml);
  const tfNames = trueFalseGroupNames(rawHtml);
  tfQuestions.forEach((q, i) => items.push(buildTrueFalseItem(q, i + 1)));

  // ── WACANA (stimulus) ─────────────────────────────────────────────────
  // Artikel berwacana: 1 teks panjang + beberapa sub-soal bernomor yang
  // menunjuk radio berbeda (temuan: hanya 1 artikel di korpus). Sub-soal itu
  // dijadikan ANAK dari soal `stimulus` lewat `parentRefIndex`.
  const wacana = detectWacana(rawHtml);
  const wacanaRadio = new Map<string, { parentIdx: number; order: number }>();
  if (wacana) {
    items.push({
      type: "stimulus",
      stem: wacana.wacana,
      options: [],
      correct: [],
      warnings: [],
      ref: { index: items.length + 1, heading: "Wacana" },
    });
    const parentIdx = items[items.length - 1]!.ref.index;
    wacana.subs.forEach((s, i) => {
      wacanaRadio.set(s.radio, { parentIdx, order: i + 1 });
    });
  }

  let idx = items.length;
  for (const name of names) {
    if (tfNames.has(name)) continue; // sudah jadi matrix_grid
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
    const stemCleaned = cleanHtml(stemSource.replace(/<\/?div\b[^>]*>/gi, "\n"));
    let stem = stemCleaned.text.trim();
    const mediaUrls = [...stemCleaned.media];

    // FALLBACK stem "pembuka bersama" (temuan 4 artikel OSNP): deskripsi soal
    // kadang berada di paragraf SEBELUM `<h4>`, bukan di dalam blok radio.
    // Bila blok tak punya stem, ambil paragraf terdekat sebelumnya (dibatasi
    // 2 blok) — kalau tetap kosong, soal memang tanpa stem → dibuang.
    if (!stem) {
      const shared = sharedStemBefore(rawHtml, name);
      if (shared) stem = shared;
    }
    // Fallback terakhir: pakai judul `<h4>` (soal berbasis gambar tanpa stem teks).
    if (!stem) {
      const heading = headingTextFor(rawHtml, name);
      if (heading) stem = heading;
    }

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
      const optCleaned = cleanHtml(lm[2]!);
      let text = optCleaned.text;
      for (const mUrl of optCleaned.media) {
        if (!mediaUrls.includes(mUrl)) mediaUrls.push(mUrl);
      }
      let label: string | undefined;
      // Label di depan: `$(A)$` → setelah cleaning jadi `\((A)\)`.
      // Bentuk nyata (char): `\` `(` `(` `A` `)` `\` `)` — jadi pola:
      // `\(` + `(` + huruf + `)` + `\)`. Toleran spasi & kurung ganda.
      // Buang HANYA bagian label — jangan sentuh math opsi.
      text = text.replace(/^\s*\\\(\s*\(?\s*([A-H])\s*\)?\s*\\\)/i, (_mm, letter: string) => {
        label = letter.toUpperCase();
        return "";
      });
      // Varian label tanpa penutup `\)`: `\((A)` — sisa `\)` di akhir opsi baru
      // boleh dibuang di kasus ini (memang sisa label).
      if (!label) {
        text = text.replace(/^\s*\\\(\s*\(?\s*([A-H])\s*\)?/i, (_mm, letter: string) => {
          label = letter.toUpperCase();
          return "";
        });
        if (label) text = text.replace(/\s*\\\)+\s*$/, "");
      }
      text = text.trim();
      if (text.startsWith("\\") && !text.startsWith("\\(") && !text.startsWith("\\[")) {
        text = `\\( ${text} \\)`;
      }
      // ⚠️ WAJIB: perbaiki KaTeX LAGI setelah pembungkusan di atas. `cleanHtml`
      // sudah menjalankan `repairAdaptive`, TAPI pembungkusan `\( … \)` di sini
      // bisa memunculkan galat baru (mis. `\{5,\[ 6,\]…$` → `$` nyasar jadi
      // delimiter). Tanpa ini, opsi tetap error meski stem/solusi bersih.
      {
        const rr = repairAdaptive(text);
        if (rr.after < rr.before) text = rr.text;
      }
      if (text) {
        opts.push({ label, text });
        if (CORRECT_VALUES.includes(val) && label) correct.push(label);
      }
    }

    // PEMBAHASAN: sumber defantri menaruh pembahasan di `<details>` setelah soal.
    let explanation = extractExplanation(group, mediaUrls);
    // Fallback: blok BS (`<ul>` berisi beberapa grup) dipotong di radio
    // berikutnya, sehingga `<details>` SETELAH `<ul>` tak ikut terbaca.
    // Ambil pembahasan dari blok soal yang menaungi grup ini.
    if (!explanation) {
      const wider = explanationBlockFor(rawHtml, name);
      if (wider) explanation = extractExplanation(wider, mediaUrls);
    }

    if (!stem) {
      skipped++;
      continue;
    }

    // mediaUrls tidak diteruskan ke finalizeItem — cleanHtml sudah menyematkan
    // gambar sebagai ![alt](url) di dalam stem/opsi (teks), dan pipeline media
    // akan mengambilnya dari sana. Meneruskan mediaUrls sebagai extraWarnings
    // (param ke-6) akan mencemari flag soal dengan URL gambar.
    const wc = wacanaRadio.get(name);
    // Sub-soal wacana: buang penanda nomor di depan (`\(\left( 1 \right).\)`)
    // karena urutan sudah diwakili `child_order` — nomor ganda di UI.
    const childStem = wc ? stripSubNumber(stem) : stem;
    const built = finalizeItem(
      childStem,
      opts,
      correct,
      explanation,
      { index: idx, heading: undefined },
    );
    if (wc) {
      built.parentRefIndex = wc.parentIdx;
      built.childOrder = wc.order;
    }
    items.push(built);
  }

  return { items, skipped, warnings };
};

/**
 * Stem "pembuka bersama" untuk grup `name`: paragraf terdekat SEBELUM blok soal.
 *
 * Sebagian artikel (mis. 4 artikel OSNP) menaruh deskripsi soal di `<p>`
 * sebelum `<h4>`, sedangkan radio ada di dalam `<blockquote>` terpisah. Kalau
 * hanya blok radio yang dibaca, stem kosong → soal dibuang.
 *
 * PENTING: jendela pencarian HARUS pendek dan berhenti di penutup blok
 * sebelumnya. Mundur terlalu jauh akan menyerap teks UI ("Petunjuk Pengerjaan
 * Soal", tabel identitas, CSS bocor) — itu bukan stem soal.
 */
function sharedStemBefore(html: string, name: string): string {
  const first = html.search(new RegExp(`<input\\b[^>]*name="${escapeRe(name)}"`, "i"));
  if (first === -1) return "";
  const back = html.slice(0, first);

  const h4 = back.lastIndexOf("<h4");
  if (h4 === -1) return "";

  // Batas aman = SETELAH penutup blok soal sebelumnya. Apa pun sebelum itu
  // milik soal lain → jangan dipakai sebagai stem soal ini.
  const beforeH4 = back.slice(0, h4);
  const boundary = Math.max(
    beforeH4.lastIndexOf("</blockquote>"),
    beforeH4.lastIndexOf("<a name=\"more\"></a>"),
  );
  const region = boundary === -1 ? beforeH4 : beforeH4.slice(boundary);

  // Buang blok non-teks.
  const cleanedRegion = region
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<table\b[\s\S]*?<\/table>/gi, " ")
    .replace(/<\/?a\b[^>]*>/gi, " ");

  // Stem = paragraf `<p>` terakhir di region ini; tanpa `<p>`, pakai teks region.
  const paras = [...cleanedRegion.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  const candidate =
    paras.length > 0 ? paras[paras.length - 1]![1]! : cleanedRegion.replace(/<[^>]+>/g, " ");

  const cleaned = cleanHtml(candidate).text.replace(/\s+/g, " ").trim();
  if (/\bpetunjuk pengerjaan\b|\bsisa waktu\b|\bjumlah soal\b|\bnama peserta\b/i.test(cleaned)) return "";
  if (cleaned.length < 15) return "";
  return cleaned;
}

/**
 * Teks judul `<h4>` soal (mis. "2. Soal OSN-P IPA SD 2023").
 *
 * Fallback terakhir saat soal **tak punya stem teks** di sumber (soal berbasis
 * gambar/scan, umum pada OSNP). Memakai judul lebih baik daripada mengosongkan
 * — soal tetap tersimpan & bisa ditelaah, jumlah tak menyusut.
 */
function headingTextFor(html: string, name: string): string {
  const first = html.search(new RegExp(`<input\\b[^>]*name="${escapeRe(name)}"`, "i"));
  if (first === -1) return "";
  const back = html.slice(0, first);
  const at = back.lastIndexOf("<h4");
  if (at === -1) return "";
  const seg = back.slice(at);
  const text = cleanHtml(seg.replace(/<\/?h4\b[^>]*>/gi, " ")).text.replace(/\s+/g, " ").trim();
  return text.length >= 3 ? text : "";
}

/**
 * Ambil potongan HTML milik grup radio `name`: dari radio pertama grup ini
 * s/d radio pertama grup **berikutnya** (nama berbeda); disertakan mundur ke
 * pembuka soal terdekat (`<h4>`/`<h3>`/`<blockquote>`/`<!--more-->`).
 */
function extractQuestionGroup(html: string, name: string): string | null {
  const first = html.search(new RegExp(`<input\\b[^>]*name="${escapeRe(name)}"`, "i"));
  if (first === -1) return null;

  const back = html.slice(0, first);
  // Pembuka soal = tag struktural terdekat. `<!--more-->` SENGAJA tidak dipakai:
  // penanda Blogger itu sering muncul DI ANTARA stem dan `div.question`,
  // sehingga kalau ikut jadi kandidat ia "menang" → stem terpotong → soal dibuang.
  const starts = [
    back.lastIndexOf("<h4"),
    back.lastIndexOf("<h3"),
    back.lastIndexOf("<h2"),
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

/**
 * Blok soal yang MENAUNGI grup `name`, diperluas sampai mencakup `<details>`
 * pembahasan milik soal itu.
 *
 * Dipakai untuk benar-salah: beberapa grup radio berada dalam satu `<ul>`
 * (satu soal), dan `<details>` ada SETELAH `</ul>`. `extractQuestionGroup`
 * memotong di radio berikutnya → pembahasan tak terbaca. Di sini batas atas
 * ditentukan oleh penutup blok soal (`</ul>`/`</blockquote>`) yang menaungi
 * grup, tanpa melampaui soal berikutnya.
 */
function explanationBlockFor(html: string, name: string): string | null {
  const g = extractQuestionGroup(html, name);
  if (!g) return null;
  // Sudah memuat `<details>`? tak perlu diperluas.
  if (/<details\b/i.test(g)) return g;

  const first = html.search(new RegExp(`<input\\b[^>]*name="${escapeRe(name)}"`, "i"));
  if (first === -1) return null;

  // Batas SOAL berikutnya: pembuka struktur terkecil SETELAH grup ini.
  const restStart = first + 1;
  const nextStarts = [
    html.indexOf("<h4", restStart),
    html.indexOf("<blockquote", restStart),
  ].filter((i) => i !== -1);
  const nextStart = nextStarts.length ? Math.min(...nextStarts) : html.length;
  const detailsAt = html.indexOf("<details", restStart);
  if (detailsAt === -1) return null;
  // Berhenti di pembuka soal berikutnya — jangan menyerobot pembahasannya.
  const limit = Math.min(nextStart, html.length);
  if (detailsAt > limit) return null;
  const start = html.lastIndexOf("<h4", first);
  const from = start !== -1 && start < first ? start : first;
  return html.slice(from, limit);
}

/**
 * Ekstrak pembahasan dari `<details>` "Alternatif Pembahasan" bila ada.
 *
 * Struktur sumber: `<details class='sp'><summary>Alternatif Pembahasan:</summary>…isi…</details>`.
 * `<summary>` dibuang (judul, bukan isi). Media yang ditemukan ditambahkan ke
 * `mediaUrls` agar ikut diunduh.
 */
function extractExplanation(html: string, mediaUrls: string[]): string | undefined {
  const det = html.match(/<details\b[^>]*>([\s\S]*?)<\/details>/i);
  if (!det) return undefined;
  const raw = det[1]!.replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/i, "");
  const cleaned = cleanHtml(raw);
  for (const mUrl of cleaned.media) {
    if (!mediaUrls.includes(mUrl)) mediaUrls.push(mUrl);
  }
  const text = cleaned.text.trim();
  return text || undefined;
}

/** Escape untuk dipakai dalam RegExp. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
