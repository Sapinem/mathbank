/**
 * Tipe segmen & adapter ingest (M9) — selaras dengan `contracts/question.ts`.
 *
 * Lapisan ini **tahu soal & sumber** (berbeda dari `clean.ts` yang general).
 * Fungsi murni (L6, tanpa DB/network).
 */
import type { z } from "zod";
import { PAYLOAD_TYPE_BY_QUESTION_TYPE } from "@/lib/contracts/question";
import type { questionTypeSchema } from "@/lib/contracts/question";

export type ParsedQuestionType = z.infer<typeof questionTypeSchema>;

/** Satu soal hasil ekstraksi (sebelum disimpan ke DB). */
export interface ParsedItem {
  /** Jenis soal (default `single_choice`; `essay` bila tak ada opsi). */
  type: ParsedQuestionType;
  /** Teks soal (math sudah \(...\) / \[...\]). */
  stem: string;
  /** Opsi jawaban (kosong bila essay). */
  options: ParsedOption[];
  /** Kunci jawaban — label opsi benar (mis. ["A"]); kosong bila tak pasti. */
  correct: string[];
  /** Pupuk pembahasan (bila ada). */
  explanation?: string;
  /** Catatan mutu (mis. "kunci tak ditemukan", "opsi hanya 3"). */
  warnings: string[];
  /** Payload khusus tipe (mis. matrix_grid: pernyataan + label). */
  dataPayload?: Record<string, unknown>;
  /**
   * Induk (untuk soal berwacana/stimulus). `refIndex` menunjuk `ref.index`
   * item induk di daftar yang sama; commit menerjemahkannya ke `parentId`.
   */
  parentRefIndex?: number;
  /** Posisi urutan dalam induk (untuk anak stimulus). */
  childOrder?: number;
  /** Jejak asal dalam artikel (untuk verifikasi). */
  ref: { index: number; heading?: string };
}

export interface ParsedOption {
  label: string;
  text: string;
  isCorrect: boolean;
}

/** Hasil segmentasi satu artikel. */
export interface SegmentResult {
  items: ParsedItem[];
  /** Jumlah blok yang dilewati (bukan soal). */
  skipped: number;
  warnings: string[];
}

/** Metadata artikel (dari file korpus). */
export interface ArticleMeta {
  /** Nama sumber (mathcyber | m4thlab | defantri | pusmendik_*). */
  source: string;
  url?: string;
  title?: string;
}

/**
 * Kontrak tiap adapter: terima HTML (mentah) → hasil segmentasi.
 * Adapter memakai `cleanHtml` di dalam untuk membersihkan blok yang relevan.
 */
export type ArticleAdapter = (rawHtml: string, meta?: ArticleMeta) => SegmentResult;

/**
 * Adapter untuk sumber **JSON terstruktur** (mis. pusmendik_dayaserap) —
 * tak butuh parsing HTML; data sudah terurai.
 */
export type JsonAdapter = (data: unknown, meta: ArticleMeta) => SegmentResult;

// ── Pembentukan payload kanonik (MAT-147) ─────────────────────────────────────
//
// Sejak Single Table + Hybrid JSONB (MAT-144/MAT-146) opsi & kunci soal tinggal
// di `questions.data_payload` / `questions.answer_key` — tabel `question_options`
// sudah tidak ada. Adapter tetap menghasilkan `ParsedItem` yang ramah-parser
// (`options[]` + `correct[]`); fungsi di bawah ini yang menerjemahkannya ke
// bentuk kanonik yang divalidasi `src/lib/validations/question-payload.ts`
// sebelum `createQuestion` dipanggil.
//
// Pemetaan tipe DB → tipe payload kanonik memakai satu sumber kebenaran
// (`PAYLOAD_TYPE_BY_QUESTION_TYPE`) supaya adapter & commit tak pernah berbeda.

/**
 * Placeholder pembahasan untuk soal yang di sumbernya memang tak berpembahasan.
 *
 * `answerKeySchema` (MAT-145) mewajibkan `explanationMarkdown` minimal 1 karakter.
 * Daripada mengarang pembahasan, dipasang penanda eksplisit bahwa pembahasan
 * belum ada — butirnya tetap `draft` + `isFlagged` sehingga guru tahu harus
 * melengkapinya.
 */
export const MISSING_EXPLANATION_PLACEHOLDER =
  "_(Pembahasan belum tersedia di sumber — perlu dilengkapi guru.)_";

/**
 * Placeholder rubrik untuk soal uraian/isian tanpa rubrik di sumber.
 *
 * `textInputPayloadSchema` mewajibkan `rubricGuidelines` ≥ 20 karakter.
 */
export const MISSING_RUBRIC_PLACEHOLDER =
  "Belum ada rubrik di sumber. Susun langkah penilaian: ketepatan langkah pengerjaan, hasil akhir, dan satuan (perlu telaah guru).";

/** Huruf label opsi (0→A). Salinan lokal agar `types.ts` tak impor `items.ts`. */
const LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

function labelFor(index: number): string {
  return LABELS[index] ?? String(index + 1);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asLabel(value: unknown): string {
  return asText(value).toUpperCase();
}

/** Hasil pembentukan payload: bentuk kanonik + catatan mutu yang harus di-flag. */
export interface BuiltQuestionPayload {
  /** Calon `questions.data_payload` (divalidasi `questionDataPayloadSchema`). */
  dataPayload: Record<string, unknown>;
  /** Calon `questions.answer_key` (divalidasi `answerKeySchema`). */
  answerKey: Record<string, unknown>;
  /** Catatan mutu tambahan dari proses konversi (mis. placeholder dipasang). */
  warnings: string[];
}

/**
 * Terjemahkan satu `ParsedItem` (bentuk ramah-parser) → `data_payload` +
 * `answer_key` kanonik (MAT-145).
 *
 * Fungsi **murni** — tanpa DB/network, tak melempar galat. Pelanggaran skema
 * Zod sengaja TIDAK ditangani di sini: `commitItems` yang memanggil
 * `questionDataPayloadSchema.safeParse()` / `answerKeySchema.safeParse()` agar
 * butir bermasalah ditolak dengan pesan validasi yang jelas (DoD MAT-147).
 *
 * Pemetaan per tipe:
 *   single_choice & sejenis      → `multiple_choice` + `options[]`
 *   multiple_choice_checkbox     → `complex_multiple_choice` + `options[]`
 *   matrix_grid                  → `matrix` (columns + statements + matrixAnswers)
 *   matching                     → `matching` (premises + responses + matchingPairs)
 *   short_answer / essay         → `short_answer` / `essay` (rubricGuidelines)
 *   stimulus                     → kontainer wacana: `data_payload` apa adanya,
 *                                  `answer_key` kosong (tak punya kunci sendiri)
 */
export function buildQuestionPayload(item: ParsedItem): BuiltQuestionPayload {
  const warnings: string[] = [];
  const payloadType = PAYLOAD_TYPE_BY_QUESTION_TYPE[item.type];

  // ── Kontainer (stimulus/wacana): tak punya kunci jawaban sendiri ──────────
  if (!payloadType) {
    return { dataPayload: { ...(item.dataPayload ?? {}) }, answerKey: {}, warnings };
  }

  const explanation = asText(item.explanation);
  if (!explanation) {
    warnings.push("Pembahasan kosong di sumber — placeholder dipasang, perlu dilengkapi");
  }
  const answerKey: Record<string, unknown> = {
    explanationMarkdown: explanation || MISSING_EXPLANATION_PLACEHOLDER,
  };

  // ── Pilihan ganda (single & kompleks) ─────────────────────────────────────
  if (payloadType === "multiple_choice" || payloadType === "complex_multiple_choice") {
    const options = item.options
      .map((o, i) => ({
        id: asLabel(o.label) || labelFor(i),
        contentMarkdown: asText(o.text),
      }))
      .filter((o) => o.contentMarkdown.length > 0);

    // Kunci hanya diterima bila labelnya benar-benar ada di antara opsi.
    const ids = new Set(options.map((o) => o.id));
    const correct = [...new Set(item.correct.map(asLabel).filter((l) => ids.has(l)))];
    if (correct.length > 0) {
      // `multiple_choice` = satu kunci (string); kompleks = array label.
      answerKey.correctOptionIds =
        payloadType === "multiple_choice" && correct.length === 1 ? correct[0]! : correct;
    }

    return {
      dataPayload: { type: payloadType, options, shuffleOptions: true },
      answerKey,
      warnings,
    };
  }

  // ── Matriks (Benar/Salah per pernyataan) ──────────────────────────────────
  if (payloadType === "matrix") {
    const src = (item.dataPayload ?? {}) as Record<string, unknown>;
    const columns = (
      Array.isArray(src.columns) ? src.columns : Array.isArray(src.labels) ? src.labels : []
    )
      .map(asText)
      .filter(Boolean);

    const rawRows = Array.isArray(src.statements)
      ? src.statements
      : Array.isArray(src.rows)
        ? src.rows
        : [];

    const statements: { id: string; contentMarkdown: string }[] = [];
    const matrixAnswers: Record<string, string> = {};
    for (const raw of rawRows) {
      const row = (raw ?? {}) as Record<string, unknown>;
      const contentMarkdown = asText(row.contentMarkdown) || asText(row.text);
      if (!contentMarkdown) continue; // pernyataan kosong → jangan simpan sampah
      const id = asText(row.id) || `s${statements.length + 1}`;
      statements.push({ id, contentMarkdown });

      const answer = asText(row.answer);
      if (!answer) continue; // kunci tak ada di sumber → jangan menebak
      const column = columns.find((c) => c.toLowerCase() === answer.toLowerCase());
      if (column) matrixAnswers[id] = column;
      else warnings.push(`Kunci "${answer}" pernyataan ${id} tak cocok dengan kolom — dilewati`);
    }

    if (Object.keys(matrixAnswers).length > 0) answerKey.matrixAnswers = matrixAnswers;
    const rows = statements.map((s) => ({ text: s.contentMarkdown, answer: matrixAnswers[s.id] ?? "" }));
    return {
      dataPayload: { type: "matrix", columns, statements, labels: columns, rows },
      answerKey,
      warnings,
    };
  }

  // ── Menjodohkan ───────────────────────────────────────────────────────────
  if (payloadType === "matching") {
    const src = (item.dataPayload ?? {}) as Record<string, unknown>;
    const pairItems = (value: unknown, prefix: string) =>
      (Array.isArray(value) ? value : [])
        .map((raw, i) => {
          const row = (raw ?? {}) as Record<string, unknown>;
          return {
            id: asText(row.id) || `${prefix}${i + 1}`,
            contentMarkdown: asText(row.contentMarkdown) || asText(row.text),
          };
        })
        .filter((p) => p.contentMarkdown.length > 0);

    const premises = pairItems(src.premises, "p");
    const responses = pairItems(src.responses, "r");

    const pairsRaw =
      (src.matchingPairs as Record<string, unknown> | undefined) ??
      (src.pairs as Record<string, unknown> | undefined) ??
      {};
    const matchingPairs: Record<string, string> = {};
    for (const [key, value] of Object.entries(pairsRaw)) {
      const target = asText(value);
      if (target) matchingPairs[key] = target;
    }
    if (Object.keys(matchingPairs).length > 0) answerKey.matchingPairs = matchingPairs;

    return { dataPayload: { type: "matching", premises, responses }, answerKey, warnings };
  }

  // ── Isian singkat / esai ──────────────────────────────────────────────────
  const src = (item.dataPayload ?? {}) as Record<string, unknown>;
  let rubricGuidelines = asText(src.rubricGuidelines);
  if (!rubricGuidelines) {
    rubricGuidelines = MISSING_RUBRIC_PLACEHOLDER;
    warnings.push("Rubrik penilaian kosong di sumber — placeholder dipasang, perlu telaah");
  }
  const expectedLength = asText(src.expectedLength);

  return {
    dataPayload: {
      type: payloadType,
      rubricGuidelines,
      ...(expectedLength ? { expectedLength } : {}),
    },
    answerKey,
    warnings,
  };
}
