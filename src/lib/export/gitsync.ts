import { buildMoodleXml, type MoodleQuestion, type BuildMoodleResult } from "@/lib/export/moodle-xml";
import { cdata } from "@/lib/export/xml-escape";
import { createZip, type ZipEntry } from "@/lib/export/zip";

/**
 * Ekspor GitSync (M12, keputusan user 2026-09-30).
 *
 * Skema `qbank_gitsync` mengharapkan **struktur folder**, bukan satu berkas:
 *   top/<Topik>/<Subtopik>/<NamaSoal>.xml
 * Tiap `.xml` = satu soal (`<quiz>` berisi tepat satu `<question>`).
 *
 * **D5**: kategori diambil dari **TOPIK** soal; tanpa topik → folder `Tanpa Topik`.
 * **D6**: dibungkus ZIP tanpa dependency (lihat `zip.ts`).
 *
 * Manifest `*_question_manifest.json` **tidak** dibuat di sini — itu milik CLI GitSync.
 */

/** Soal + topik (untuk penempatan folder). */
export interface GitsyncQuestion extends MoodleQuestion {
  /** Jalur topik dari akar → daun (mis. ["Aljabar","Persamaan"]). Kosong = tanpa topik. */
  topicPath: string[];
}

export interface GitsyncResult extends Omit<BuildMoodleResult, "xml"> {
  /** Isi ZIP (hanya bila `ok`). */
  zip: Buffer | null;
  /** Daftar berkas yang dibuat (untuk ringkasan/uji). */
  files: string[];
}

const NO_TOPIC = "Tanpa Topik";

/**
 * Sanitasi satu segmen nama folder/berkas agar aman di semua OS & Git.
 * Hanya `A–Z a–z 0–9 . _ -` yang dipertahankan; sisanya → `-`.
 */
export function sanitizeName(name: string, maxLength = 100): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // buang diakritik
    .replace(/[^A-Za-z0-9._-]+/g, "-") // apa pun di luar himpunan aman → "-"
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .trim();
  const safe = cleaned || "soal";
  return safe.slice(0, maxLength);
}

/** Nama berkas soal: `<nomor?>-<slug>-<idpendek>.xml` (id menjamin unik). */
function questionFileName(q: GitsyncQuestion, index: number): string {
  const base = sanitizeName(q.name || "soal", 80);
  const num = q.itemNumber ? `${sanitizeName(q.itemNumber, 12)}-` : `${index + 1}-`;
  return `${num}${base}.xml`;
}

/** `gitsync_category.xml` — info kategori (dibaca GitSync; opsional tapi dianjurkan). */
function categoryXml(name: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<category>\n` +
    `  <name>${cdata(name)}</name>\n` +
    `</category>\n`
  );
}

/**
 * Bangun ZIP GitSync dari daftar soal bertopik.
 * Bila ada soal tanpa kunci ⇒ `ok:false`, `zip:null` (D4 — tolak).
 */
export function buildGitsyncZip(questions: GitsyncQuestion[]): GitsyncResult {
  const entries: ZipEntry[] = [];
  const skipped: BuildMoodleResult["skipped"] = [];
  const withoutAnswerKey: string[] = [];
  const files: string[] = [];
  const categoriesSeen = new Set<string>();

  let exported = 0;
  questions.forEach((q, i) => {
    // Satu soal per berkas → pakai buildMoodleXml per soal.
    const single = buildMoodleXml([q]);
    if (!single.ok) {
      withoutAnswerKey.push(q.itemNumber ? `${q.itemNumber}. ${q.name}` : q.name);
    }
    if (single.skipped.length) {
      skipped.push(...single.skipped);
      return;
    }
    // Folder = jalur topik (sanitasi tiap segmen). Kosong → "Tanpa Topik".
    const segments = (q.topicPath.length ? q.topicPath : [NO_TOPIC]).map((s) =>
      sanitizeName(s),
    );
    // Nama kategori (untuk gitsync_category.xml) = teks asli, bukan folder.
    const names = q.topicPath.length ? q.topicPath : [NO_TOPIC];
    // Catat kategori (buat gitsync_category.xml sekali per folder unik).
    let acc = "top";
    let depth = 0;
    for (const seg of segments) {
      acc = `${acc}/${seg}`;
      if (!categoriesSeen.has(acc)) {
        categoriesSeen.add(acc);
        entries.push({
          name: `${acc}/gitsync_category.xml`,
          data: Buffer.from(categoryXml(names[depth] ?? seg), "utf8"),
        });
        files.push(`${acc}/gitsync_category.xml`);
      }
      depth++;
    }
    const dir = `top/${segments.join("/")}`;
    const file = `${dir}/${questionFileName(q, i)}`;
    entries.push({ name: file, data: Buffer.from(single.xml, "utf8") });
    files.push(file);
    exported++;
  });

  const ok = withoutAnswerKey.length === 0;
  return {
    ok,
    zip: ok ? createZip(entries) : null,
    exported,
    skipped,
    withoutAnswerKey,
    files,
  };
}
