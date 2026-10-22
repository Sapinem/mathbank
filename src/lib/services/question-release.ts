import {
  enforceQuestionWriteGate,
  PAYLOAD_TYPE_BY_QUESTION_TYPE,
  type QuestionWriteGateInput,
} from "@/lib/contracts/question";

/**
 * **MAT-150** — kontrak rilis untuk jalur FSM (transisi status → `ready`).
 *
 * MAT-146 memasang `enforceQuestionWriteGate()` (3 lapis Zod) pada jalur tulis
 * (`createQuestion` / `updateQuestion` / `enrichQuestion`), tetapi transisi
 * status punya jalur sendiri. Tanpa modul ini, `draft → ready` bisa melewati
 * kontrak pedagogis (distractor rationale, rubrik esai, `explanationMarkdown`)
 * hanya dengan memenuhi `assertReady()` (cek `answer_key` tidak kosong).
 *
 * Kenapa bukan `assertReady` saja: `assertReady` hanya menjawab "apakah ada
 * jawaban?", sedangkan kontrak rilis menjawab "apakah soal ini layak dipakai
 * siswa?". Dua pertanyaan berbeda; yang kedua wajib ditegakkan di semua jalur
 * yang bisa menghasilkan status `ready` (satuan **dan** massal).
 *
 * Modul ini sengaja **tanpa I/O** (fungsi murni) supaya bisa dipakai jalur
 * satuan (`changeQuestionStatus`) maupun jalur massal (`bulkQuestionAction`)
 * tanpa menambah query.
 */

/** Bentuk minimal baris soal yang dibutuhkan kontrak rilis. */
export interface ReleaseCandidate {
  questionType: string;
  dataPayload: Record<string, unknown> | null;
  answerKey: Record<string, unknown> | null;
}

/**
 * Tegakkan kontrak rilis pada soal yang akan berstatus `ready`.
 *
 * @throws QuestionPayloadValidationError (HTTP 422) bila payload tidak
 *   memenuhi kontrak pedagogis — jalur galat identik dengan gerbang tulis.
 */
export function assertReleaseContract(candidate: ReleaseCandidate): void {
  const dataPayload = (candidate.dataPayload ?? {}) as Record<string, unknown>;
  const mapped =
    PAYLOAD_TYPE_BY_QUESTION_TYPE[
      candidate.questionType as keyof typeof PAYLOAD_TYPE_BY_QUESTION_TYPE
    ] ?? null;

  // `data_payload.type` adalah diskriminator kontrak MAT-145. Baris warisan
  // (sebelum MAT-146) bisa belum punya `type` walau `question_type`-nya sudah
  // benar — turunkan dari `question_type` (peta deterministik dari enum DB,
  // bukan input pengguna) agar gerbang menilai payload yang sebenarnya dan
  // tidak ada celah "payload tanpa type = lolos".
  const canonicalPayload =
    mapped && typeof dataPayload.type !== "string"
      ? { ...dataPayload, type: mapped }
      : dataPayload;

  const base: QuestionWriteGateInput = {
    questionType: candidate.questionType as QuestionWriteGateInput["questionType"],
    dataPayload: canonicalPayload,
    answerKey: (candidate.answerKey ?? {}) as Record<string, unknown>,
  };

  // `stimulus` = wadah bacaan (tabel `stimulus`), tak punya opsi/rubrik; lihat
  // pengecualian yang sama di `assertReady()` (question-fsm.ts). Lapis 1 & 2
  // tetap dijalankan; hanya lapis 3 (kontrak rilis) yang tidak berlaku.
  enforceQuestionWriteGate(
    mapped === null ? base : { ...base, status: "ready" },
  );
}
