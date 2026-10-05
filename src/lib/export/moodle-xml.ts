import { cdata } from "@/lib/export/xml-escape";
import { moodleTypeOf, isSingleAnswer } from "@/lib/export/moodle-map";
import { toMoodleLatex } from "@/lib/export/latex-to-moodle";
import type { questionTypeSchema } from "@/lib/contracts/question";
import type { z } from "zod";

type QuestionType = z.infer<typeof questionTypeSchema>;

/**
 * Pembangun Moodle XML (M12) — FUNGSI MURNI (tanpa DB), mudah diuji.
 *
 * Keputusan (2026-09-30):
 *  - **D1**: stimulus di-INLINE ke tiap soal anak (anak mandiri).
 *  - **D2**: tipe tak dipetakan (`matrix_grid`/`matching`) → **dilewati + dilaporkan**.
 *  - **D3**: rumus **dinormalisasi ke separator Moodle** `\\(…\\)` / `\\[…\\]`
 *    (bukan `$…$`) agar dikenali filter TeX Moodle.
 *  - **D4 (diperbarui 2026-09-30)**: soal **tanpa kunci = DITOLAK** (blokir ekspor).
 */

/** Soal siap-ekspor (bentuk minimal; disusun oleh pemanggil dari DB). */
export interface MoodleQuestion {
  type: QuestionType;
  /** Teks soal (Markdown + LaTeX mentah). */
  content: string;
  /** Teks stimulus induk (bila soal ini anak stimulus) — di-INLINE di depan. */
  stimulusContent?: string | null;
  /** Opsi (untuk multichoice). */
  options: { label: string; content: string; isCorrect: boolean }[];
  /** Kunci jawaban (untuk shortanswer/essay & cadangan). */
  answerText?: string | null;
  /** Pembahasan (opsional). */
  explanation?: string | null;
  /** Nama soal di Moodle. */
  name: string;
  /** Nomor butir (opsional, ditampilkan di nama). */
  itemNumber?: string | null;
}

export interface BuildMoodleResult {
  /** XML final (hanya bila `ok`). */
  xml: string;
  /** True bila ekspor boleh dilanjutkan (tak ada soal tanpa kunci — D4). */
  ok: boolean;
  /** Soal yang berhasil diekspor. */
  exported: number;
  /** Soal yang dilewati (tipe tak didukung) + alasannya. */
  skipped: { name: string; type: QuestionType; reason: string }[];
  /** Soal tanpa kunci — **memblokir** ekspor (D4). */
  withoutAnswerKey: string[];
}

/** Fraksi Moodle (persen). Benar = 100, salah = 0. */
const FRACTION_CORRECT = "100";
const FRACTION_WRONG = "0";

/**
 * Format fraksi Moodle (5 desimal, selaras Moodle XML v4/v5).
 * Nilai `-0` dinormalkan menjadi `0`.
 */
function moodleFraction(value: number): string {
  const v = Object.is(value, -0) ? 0 : value;
  return v.toFixed(5);
}

/**
 * Hitung fraksi per opsi untuk soal **multi-jawaban** (checkbox,
 * `<single>false</single>`).
 *
 * API-02: sebelumnya setiap opsi benar bernilai `100` sehingga memilih dua
 * opsi benar menghasilkan total 200%. Standar Moodle mengharuskan total fraksi
 * jawaban benar = 100%, jadi fraksi dibagi rata (`100 / jumlah benar`).
 * Opsi salah tetap `0` (tanpa penalti negatif) agar kebijakan penilaian tak
 * berubah diam-diam.
 */
function checkboxFractions(options: { isCorrect: boolean }[]): number[] {
  const correctCount = options.filter((o) => o.isCorrect).length;
  const perCorrect = correctCount > 0 ? 100 / correctCount : 0;
  return options.map((o) => (o.isCorrect ? perCorrect : 0));
}

/** Susun `<questiontext>`: stimulus (bila ada) + konten soal (LaTeX dinormalisasi). */
function questionText(q: MoodleQuestion): string {
  const parts: string[] = [];
  if (q.stimulusContent?.trim()) {
    parts.push(toMoodleLatex(q.stimulusContent.trim()));
  }
  parts.push(toMoodleLatex(q.content.trim()));
  return parts.join("<br/><br/>");
}

/** Bungkus satu potongan HTML ke elemen Moodle `<text>`. */
function textEl(html: string): string {
  return `<text>${cdata(html)}</text>`;
}

/** Bangun satu `<question type="multichoice|shortanswer|essay">`. */
function buildQuestion(q: MoodleQuestion): string {
  const mtype = moodleTypeOf(q.type)!;
  const name = q.itemNumber ? `${q.itemNumber}. ${q.name}` : q.name;
  const lines: string[] = [];
  lines.push(`  <question type="${mtype}">`);
  lines.push(`    <name>${textEl(name)}</name>`);
  lines.push(`    <questiontext format="html">${textEl(questionText(q))}</questiontext>`);
  if (q.explanation?.trim()) {
    lines.push(
      `    <generalfeedback format="html">${textEl(toMoodleLatex(q.explanation.trim()))}</generalfeedback>`,
    );
  }
  lines.push(`    <defaultgrade>1.0000000</defaultgrade>`);
  lines.push(`    <penalty>0.3333333</penalty>`);

  if (mtype === "multichoice") {
    const single = isSingleAnswer(q.type);
    lines.push(`    <single>${single ? "true" : "false"}</single>`);
    lines.push(`    <shuffleanswers>true</shuffleanswers>`);
    lines.push(`    <answernumbering>ABC</answernumbering>`);
    const fractions = single ? null : checkboxFractions(q.options);
    q.options.forEach((o, i) => {
      // API-02: single → 100/0; checkbox → fraksi proporsional (total benar = 100).
      const frac = fractions ? moodleFraction(fractions[i]!) : o.isCorrect ? FRACTION_CORRECT : FRACTION_WRONG;
      // Moodle memakai HTML (bukan Markdown) — tebalkan label secara eksplisit.
      lines.push(
        `    <answer fraction="${frac}" format="html">${textEl(
          `<strong>${o.label}.</strong> ${toMoodleLatex(o.content)}`,
        )}</answer>`,
      );
    });
  } else if (mtype === "shortanswer") {
    // Satu jawaban benar; Moodle mencocokkan teks (case-insensitive by default).
    const ans = q.answerText?.trim() ? toMoodleLatex(q.answerText.trim()) : "*";
    lines.push(`    <answer fraction="${FRACTION_CORRECT}" format="html">${textEl(ans)}</answer>`);
  } else {
    // essay: tanpa <answer>; penilaian manual.
    lines.push(`    <responseformat>editor</responseformat>`);
  }

  lines.push(`  </question>`);
  return lines.join("\n");
}

/**
 * Bangun berkas Moodle XML dari daftar soal.
 * `categoryName` opsional → menambah `<question type="category">` di depan.
 *
 * **D4**: bila ada soal tanpa kunci ⇒ `ok:false` & `xml:""` (**ekspor DITOLAK**).
 */
export function buildMoodleXml(
  questions: MoodleQuestion[],
  opts: { categoryName?: string } = {},
): BuildMoodleResult {
  const skipped: BuildMoodleResult["skipped"] = [];
  const withoutAnswerKey: string[] = [];
  const blocks: string[] = [];

  if (opts.categoryName?.trim()) {
    blocks.push(
      `  <question type="category">\n    <category>${textEl(
        opts.categoryName.trim(),
      )}</category>\n  </question>`,
    );
  }

  let exported = 0;
  for (const q of questions) {
    const mtype = moodleTypeOf(q.type);
    if (!mtype) {
      skipped.push({
        name: q.itemNumber ? `${q.itemNumber}. ${q.name}` : q.name,
        type: q.type,
        reason: "Tipe belum dipetakan ke Moodle (M12: dilewati).",
      });
      continue;
    }
    // Kunci: essay tak butuh (dinilai manual); multichoice butuh ≥1 benar;
    // shortanswer butuh teks jawaban.
    const hasKey =
      mtype === "essay" ||
      (mtype === "multichoice" && q.options.some((o) => o.isCorrect)) ||
      (mtype === "shortanswer" && Boolean(q.answerText?.trim()));
    if (!hasKey) {
      withoutAnswerKey.push(q.itemNumber ? `${q.itemNumber}. ${q.name}` : q.name);
    }
    blocks.push(buildQuestion(q));
    exported++;
  }

  const ok = withoutAnswerKey.length === 0;
  // D4: tolak ekspor bila ada soal tanpa kunci.
  const xml = ok
    ? `<?xml version="1.0" encoding="UTF-8"?>\n<quiz>\n${blocks.join("\n")}\n</quiz>\n`
    : "";
  return { xml, ok, exported, skipped, withoutAnswerKey };
}
