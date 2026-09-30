import { buildMoodleXml, type MoodleQuestion, type BuildMoodleResult } from "@/lib/export/moodle-xml";
import { escapeXmlText } from "@/lib/export/xml-escape";

/**
 * Ekspor GitSync (M12) — sesuai spesifikasi **`maths/moodle-qbank_gitsync`**
 * (terverifikasi dari sumber primer 2026-09-30; lihat `docs/RENCANA-MOODLE.md` §10).
 *
 * Struktur (persis seperti yang dihasilkan CLI `createrepo.php`/`exportrepofrommoodle.php`):
 *   <repo>/top/<Kategori>/<Subkategori>/<NamaSoal>.xml
 *   <repo>/top/<Kategori>/<Subkategori>/gitsync_category.xml
 * Tiap berkas soal = satu `<quiz>` berisi tepat satu `<question>`.
 *
 * **D5**: kategori diambil dari **TOPIK** soal; tanpa topik → folder `Tanpa Topik`.
 * **D7**: keluaran = **daftar berkas** (nama + isi), ditulis ke disk oleh `gitsync-writer`.
 *         **Tidak ada ZIP/tar** — GitSync hanya membaca isi folder.
 *
 * Manifest `*_question_manifest.json` **tidak** dibuat — itu milik CLI GitSync.
 */

/** Soal + topik (untuk penempatan folder). */
export interface GitsyncQuestion extends MoodleQuestion {
  /** Jalur topik dari akar → daun (mis. ["Aljabar","Persamaan"]). Kosong = tanpa topik. */
  topicPath: string[];
}

/** Satu berkas hasil ekspor (nama relatif + isi). */
export interface GitsyncFile {
  /** Jalur relatif dari akar repo, mis. `top/Aljabar/Soal.xml`. */
  path: string;
  /** Isi berkas (UTF-8). */
  content: string;
}

export interface GitsyncResult extends Omit<BuildMoodleResult, "xml"> {
  /** Berkas-berkas yang akan ditulis (hanya bila `ok`). */
  files: GitsyncFile[];
  /** Daftar jalur saja (untuk ringkasan/uji). */
  paths: string[];
}

const NO_TOPIC = "Tanpa Topik";

/**
 * `BAD_CHARACTERS` GitSync (disalin persis dari `cli_helper.php`):
 *   /[\/\\\?\%\'\*:|\"<> .$!\`&\t]+/  → diganti `-`
 * Termasuk **spasi**, titik, `$`, `!`, `` ` ``, `&`, TAB, dll.
 */
const BAD_CHARACTERS = /[\/\\?%'*:|"<> .$!`&\t]+/g;

/** Batas panjang bawaan GitSync (`export_trait.php`). */
export const MAX_CAT_LENGTH = 200;
export const MAX_Q_LENGTH = 230;

/**
 * Sanitasi satu segmen nama ala GitSync.
 *
 * GitSync memotong dulu (`substr`) **lalu** mengganti `BAD_CHARACTERS` dengan `-`.
 * Kita meniru urutan itu agar nama folder/berkas identik.
 */
export function sanitizeName(name: string, maxLength = MAX_CAT_LENGTH): string {
  const truncated = name.slice(0, maxLength);
  const replaced = truncated.replace(BAD_CHARACTERS, "-");
  // Bila seluruhnya karakter buruk (mis. "   " → "-") → nama cadangan.
  return /^[-]+$/.test(replaced) || !replaced ? "soal" : replaced;
}

/** `gitsync_category.xml` — bentuk WAJIB: `<question><category><text>top/Path</text>…` */
function categoryXml(categoryPath: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<question>\n` +
    `  <category>\n` +
    `    <text>${escapeXmlText(categoryPath)}</text>\n` +
    `  </category>\n` +
    `</question>\n`
  );
}

/** Nama berkas soal = nama tersanitasi + `.xml` (GitSync; tanpa prefiks nomor). */
function questionFileName(q: GitsyncQuestion): string {
  const raw = q.name?.trim() || "soal";
  return `${sanitizeName(raw, MAX_Q_LENGTH)}.xml`;
}

/**
 * Bangun daftar berkas GitSync dari daftar soal bertopik.
 * Bila ada soal tanpa kunci ⇒ `ok:false`, `files:[]` (D4 — tolak).
 */
export function buildGitsyncFiles(questions: GitsyncQuestion[]): GitsyncResult {
  const entries: GitsyncFile[] = [];
  const skipped: BuildMoodleResult["skipped"] = [];
  const withoutAnswerKey: string[] = [];
  const categoriesSeen = new Set<string>();
  /** Nama berkas terpakai per folder (untuk penomoran `_2`, `_3` ala GitSync). */
  const usedNames = new Set<string>();

  let exported = 0;
  for (const q of questions) {
    // Satu soal per berkas → pakai buildMoodleXml per soal.
    const single = buildMoodleXml([q]);
    if (!single.ok) {
      withoutAnswerKey.push(q.itemNumber ? `${q.itemNumber}. ${q.name}` : q.name);
    }
    if (single.skipped.length) {
      skipped.push(...single.skipped);
      continue;
    }

    // Segmen folder = tiap bagian topik disanitasi; kosong → "Tanpa Topik".
    const rawPath: string[] = q.topicPath.length ? q.topicPath : [NO_TOPIC];
    const segments = rawPath.map((s) => sanitizeName(s, MAX_CAT_LENGTH));

    // Tulis gitsync_category.xml untuk tiap level (kecuali `top`), sekali per folder.
    let acc = "top";
    for (let d = 0; d < segments.length; d++) {
      acc = `${acc}/${segments[d]}`;
      if (!categoriesSeen.has(acc)) {
        categoriesSeen.add(acc);
        // Jalur kategori penuh (mulai `top`) — komponen asli, bukan tersanitasi.
        const fullPath = ["top", ...rawPath.slice(0, d + 1)].join("/");
        entries.push({ path: `${acc}/gitsync_category.xml`, content: categoryXml(fullPath) });
      }
    }

    // Berkas soal: nama tersanitasi; bentrok → `_2`, `_3`, … (ala GitSync).
    const dir = `top/${segments.join("/")}`;
    const baseName = questionFileName(q);
    const stem = baseName.slice(0, -4); // buang ".xml"
    let fileName = baseName;
    let i = 2;
    while (usedNames.has(`${dir}/${fileName}`)) {
      fileName = `${stem}_${i}.xml`;
      i++;
    }
    usedNames.add(`${dir}/${fileName}`);

    entries.push({ path: `${dir}/${fileName}`, content: single.xml });
    exported++;
  }

  const ok = withoutAnswerKey.length === 0;
  return {
    ok,
    files: ok ? entries : [],
    paths: ok ? entries.map((e) => e.path) : [],
    exported,
    skipped,
    withoutAnswerKey,
  };
}
